/**
 * parser.js — Client-side Amazon order data parser
 * Ports the Python process_orders.py 1:1 to JavaScript.
 * All processing happens in the browser. No data leaves the client.
 */

// ── CSV Parser ──
function parseCSV(text) {
  // Split text into logical lines, preserving quotes so splitCSVLine can use them.
  // Only split on newlines that are NOT inside quoted fields.
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (vals[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Categories dictionary (same as Python) ──
const CATEGORIES = {
  'Electronics': ['battery', 'batteries', 'cable', 'charger', 'usb', 'hdmi', 'adapter', 'bluetooth', 'speaker', 'headphone', 'earphone', 'mouse', 'keyboard', 'monitor', 'laptop', 'phone', 'tablet', 'camera', 'alexa', 'echo', 'kindle', 'fire stick', 'roku', 'tv', 'screen protector', 'power bank', 'surge', 'led light', 'bulb', 'extension cord', 'robot vacuum', 'roomba', 'vacuum', 'ring', 'doorbell', 'thermostat', 'smart home', 'wifi', 'router', 'meter', 'multimeter', 'clamp meter', 'gauss', 'sensor'],
  'Home & Kitchen': ['glass food', 'container', 'pot', 'pan', 'knife', 'cutting board', 'towel', 'dish', 'soap', 'sponge', 'trash bag', 'garbage', 'organizer', 'shelf', 'rack', 'hook', 'hanger', 'curtain', 'pillow', 'blanket', 'sheet', 'mattress', 'furniture', 'chair', 'desk', 'table', 'storage', 'basket', 'bin', 'drawer', 'candle', 'air freshener', 'filter', 'water filter', 'brita', 'faucet', 'downspout', 'plumbing', 'valve', 'pipe', 'fitting', 'brass', 'wart remover'],
  'Tools & Hardware': ['drill', 'saw', 'hammer', 'screwdriver', 'wrench', 'socket', 'plier', 'tape measure', 'level', 'dewalt', 'makita', 'milwaukee', 'bosch', 'pneumatic', 'air tool', 'nailer', 'compressor', 'sander', 'grinder', 'bit holder', 'flexshaft', 'flex-drain', 'dust off', 'compressed gas', '3-in-one', 'backflow'],
  'Health & Personal Care': ['vitamin', 'supplement', 'protein', 'probiotic', 'omega', 'fish oil', 'collagen', 'melatonin', 'zinc', 'magnesium', 'greens', 'athletic greens', 'body wash', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'floss', 'deodorant', 'sunscreen', 'moisturizer', 'lotion', 'cream', 'soap', 'hand sanitizer', 'bandage', 'first aid', 'medicine', 'cold brew', 'citrucel', 'fiber', 'saline', 'nasal', 'wipes', 'grip strength', 'remedies'],
  'Baby & Kids': ['baby', 'infant', 'toddler', 'diaper', 'wipe', 'formula', 'bottle', 'pacifier', 'stroller', 'car seat', 'crib', 'nursery', 'onesie', 'little remedies'],
  'Books': ['book', 'novel', 'guide', 'world without cancer', 'lost symbol', 'fourth turning', 'dark psychology', 'bad therapy'],
  'Outdoor & Garden': ['seed', 'plant', 'garden', 'soil', 'fertilizer', 'hose', 'sprinkler', 'mower', 'trimmer', 'leaf', 'outdoor', 'camping', 'tent', 'sleeping bag', 'backpack', 'flashlight', 'lantern', 'fire starter', 'kettle', 'sea to summit', 'pepper', 'heirloom', 'banana pepper'],
  'Clothing & Shoes': ['shirt', 'pants', 'jeans', 'jacket', 'coat', 'dress', 'shorts', 'socks', 'underwear', 'shoes', 'boots', 'sandals', 'hat', 'gloves', 'scarf', 'belt'],
  'Pet Supplies': ['dog', 'cat', 'pet', 'food bowl', 'leash', 'collar', 'toy', 'treats', 'flea', 'tick'],
  'Media & Entertainment': ['movie', 'dvd', 'blu-ray', '4k uhd', 'vinyl', 'record', 'video game', 'playstation', 'xbox', 'nintendo', 'jason bourne', 'terminator', 'angel has fallen', 'salvation', 'watchup'],
  'Audible & Subscriptions': ['audible premium', 'audible subscription', 'prime', 'music unlimited'],
};

function categorizeProduct(productName, orderType) {
  const prod = productName.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    for (const kw of keywords) {
      if (prod.includes(kw)) return cat;
    }
  }
  if (orderType === 'audible') return 'Audible & Subscriptions';
  if (orderType === 'digital' || orderType === 'subscription') return 'Media & Entertainment';
  return 'Other';
}

// ── Parse ISO date string ──
function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.replace('Z', '+00:00');
    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch (e) {
    return null;
  }
}

function cleanPrice(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/'/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ── Parse Physical Orders ──
function parsePhysicalOrders(csvText) {
  const rows = parseCSV(csvText);
  const orders = [];
  for (const row of rows) {
    try {
      const orderDate = row['Order Date'] || '';
      if (!orderDate) continue;
      const dt = parseDate(orderDate);
      if (!dt) continue;

      const unitPrice = cleanPrice(row['Unit Price']);
      const unitPriceTax = cleanPrice(row['Unit Price Tax']);
      const quantity = parseInt(row['Original Quantity'] || '1') || 1;
      const itemTotal = unitPrice + unitPriceTax;
      const productName = row['Product Name'] || 'Unknown';
      const orderId = row['Order ID'] || '';

      const shippingOption = row['Shipping Option'] || '';
      const shippingLower = shippingOption.toLowerCase();
      const isSns = shippingLower.includes('sns') || shippingLower.includes('sss');

      orders.push({
        date: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
        year: dt.getUTCFullYear(),
        month: dt.getUTCMonth() + 1,
        day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getUTCDay()],
        hour: dt.getUTCHours(),
        product: productName.substring(0, 100),
        price: Math.round(unitPrice * 100) / 100,
        tax: Math.round(unitPriceTax * 100) / 100,
        total: Math.round(itemTotal * 100) / 100,
        quantity: quantity,
        order_id: orderId,
        type: 'physical',
        category: '',
        asin: row['ASIN'] || '',
        status: row['Order Status'] || '',
        shipping: shippingOption,
        is_sns: isSns,
      });
    } catch (e) {
      continue;
    }
  }
  return orders;
}

// ── Parse Digital Orders ──
function parseDigitalOrders(csvText) {
  const rows = parseCSV(csvText);
  const orders = [];
  const digitalSeen = new Set();

  for (const row of rows) {
    try {
      const component = row['Component Type'] || '';
      if (component !== 'Price Amount') continue;

      const orderDate = row['Order Date'] || '';
      if (!orderDate) continue;
      const dt = parseDate(orderDate);
      if (!dt) continue;

      const txAmount = parseFloat(row['Transaction Amount'] || '0') || 0;
      if (txAmount <= 0) continue;

      const productName = row['Product Name'] || 'Unknown';
      const orderId = row['Order ID'] || '';
      const marketplace = row['Marketplace'] || '';

      const dedupKey = `${orderId}_${productName}`;
      if (digitalSeen.has(dedupKey)) continue;
      digitalSeen.add(dedupKey);

      let subType = 'digital';
      if (row['Subscription Order Type']) subType = 'subscription';
      if (marketplace.toLowerCase().includes('audible')) subType = 'audible';

      orders.push({
        date: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
        year: dt.getUTCFullYear(),
        month: dt.getUTCMonth() + 1,
        day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getUTCDay()],
        hour: dt.getUTCHours(),
        product: (productName !== 'Not Applicable' ? productName : 'Digital Purchase').substring(0, 100),
        price: Math.round(txAmount * 100) / 100,
        tax: 0,
        total: Math.round(txAmount * 100) / 100,
        quantity: 1,
        order_id: orderId,
        type: subType,
        category: '',
        asin: row['ASIN'] || '',
        status: 'Closed',
        shipping: '',
      });
    } catch (e) {
      continue;
    }
  }
  return orders;
}

// ── Parse Refunds ──
function parseRefunds(csvText) {
  const rows = parseCSV(csvText);
  const refunds = [];
  const seenRefunds = new Set();

  for (const row of rows) {
    try {
      const refundDate = row['Refund Date'] || '';
      if (!refundDate) continue;
      const dt = parseDate(refundDate);
      if (!dt) continue;

      const amount = parseFloat(row['Refund Amount'] || '0') || 0;
      const orderId = row['Order ID'] || '';
      const reason = row['Reversal Reason'] || 'Unknown';

      const dedupKey = `${orderId}_${amount}_${refundDate}`;
      if (seenRefunds.has(dedupKey)) continue;
      seenRefunds.add(dedupKey);

      refunds.push({
        date: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
        year: dt.getUTCFullYear(),
        month: dt.getUTCMonth() + 1,
        amount: Math.round(amount * 100) / 100,
        order_id: orderId,
        reason: reason,
      });
    } catch (e) {
      continue;
    }
  }
  return refunds;
}

// ── Build aggregated data JSON ──
function buildAggregatedData(orders, refunds) {
  // Categorize
  for (const order of orders) {
    order.category = categorizeProduct(order.product, order.type);
  }

  // Monthly spend/count
  const monthlySpend = {};
  const monthlyCount = {};
  for (const o of orders) {
    const key = `${o.year}-${String(o.month).padStart(2, '0')}`;
    monthlySpend[key] = (monthlySpend[key] || 0) + o.total;
    monthlyCount[key] = (monthlyCount[key] || 0) + 1;
  }

  // Yearly spend/count
  const yearlySpend = {};
  const yearlyCount = {};
  for (const o of orders) {
    yearlySpend[o.year] = (yearlySpend[o.year] || 0) + o.total;
    yearlyCount[o.year] = (yearlyCount[o.year] || 0) + 1;
  }

  // Category spend/count
  const catSpend = {};
  const catCount = {};
  for (const o of orders) {
    catSpend[o.category] = (catSpend[o.category] || 0) + o.total;
    catCount[o.category] = (catCount[o.category] || 0) + 1;
  }

  // Day of week
  const dowSpend = {};
  const dowCount = {};
  for (const o of orders) {
    dowSpend[o.day_of_week] = (dowSpend[o.day_of_week] || 0) + o.total;
    dowCount[o.day_of_week] = (dowCount[o.day_of_week] || 0) + 1;
  }

  // Hour of day
  const hourSpend = {};
  const hourCount = {};
  for (const o of orders) {
    hourSpend[o.hour] = (hourSpend[o.hour] || 0) + o.total;
    hourCount[o.hour] = (hourCount[o.hour] || 0) + 1;
  }

  // Top items
  const topItems = orders
    .filter(o => o.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);

  // Refund stats
  const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0);
  const refundReasons = {};
  const refundByYear = {};
  for (const r of refunds) {
    refundReasons[r.reason] = (refundReasons[r.reason] || 0) + 1;
    refundByYear[r.year] = (refundByYear[r.year] || 0) + r.amount;
  }

  // Order type breakdown
  const typeSpend = {};
  const typeCount = {};
  for (const o of orders) {
    typeSpend[o.type] = (typeSpend[o.type] || 0) + o.total;
    typeCount[o.type] = (typeCount[o.type] || 0) + 1;
  }

  // Subscribe & Save breakdown
  const snsOrders = orders.filter(o => o.is_sns);
  const snsTotalSpend = snsOrders.reduce((s, o) => s + o.total, 0);
  const snsByYear = {};
  const snsByYearCount = {};
  for (const o of snsOrders) {
    snsByYear[o.year] = (snsByYear[o.year] || 0) + o.total;
    snsByYearCount[o.year] = (snsByYearCount[o.year] || 0) + 1;
  }
  // Top S&S products by frequency
  const snsProductMap = {};
  const snsProductSpend = {};
  for (const o of snsOrders) {
    snsProductMap[o.product] = (snsProductMap[o.product] || 0) + 1;
    snsProductSpend[o.product] = (snsProductSpend[o.product] || 0) + o.total;
  }
  const topSnsProducts = Object.entries(snsProductMap)
    .map(([product, count]) => ({ product, count, spend: Math.round(snsProductSpend[product] * 100) / 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  // S&S monthly spend
  const snsMonthlySpend = {};
  const snsMonthlyCount = {};
  for (const o of snsOrders) {
    const key = `${o.year}-${String(o.month).padStart(2, '0')}`;
    snsMonthlySpend[key] = (snsMonthlySpend[key] || 0) + o.total;
    snsMonthlyCount[key] = (snsMonthlyCount[key] || 0) + 1;
  }

  // Stats
  const totalSpend = orders.reduce((s, o) => s + o.total, 0);
  const totalItems = orders.length;
  const uniqueOrders = new Set(orders.map(o => o.order_id)).size;
  const avgOrder = uniqueOrders > 0 ? totalSpend / uniqueOrders : 0;
  const years = [...new Set(orders.map(o => o.year))].sort();

  // Most expensive
  const mostExpensive = orders.length > 0
    ? orders.reduce((max, o) => o.total > max.total ? o : max, orders[0])
    : null;

  // Sorted months
  const sortedMonths = Object.keys(monthlySpend).sort();

  return {
    summary: {
      total_spend: Math.round(totalSpend * 100) / 100,
      total_items: totalItems,
      unique_orders: uniqueOrders,
      avg_order_value: Math.round(avgOrder * 100) / 100,
      years_range: years.length > 0 ? [Math.min(...years), Math.max(...years)] : [0, 0],
      total_refunds: Math.round(totalRefunds * 100) / 100,
      refund_count: refunds.length,
      most_expensive_item: mostExpensive ? mostExpensive.product : '',
      most_expensive_price: mostExpensive ? mostExpensive.total : 0,
    },
    monthly: sortedMonths.map(m => ({
      month: m,
      spend: Math.round(monthlySpend[m] * 100) / 100,
      count: monthlyCount[m],
    })),
    yearly: Object.keys(yearlySpend).map(Number).sort().map(y => ({
      year: y,
      spend: Math.round(yearlySpend[y] * 100) / 100,
      count: yearlyCount[y],
    })),
    categories: Object.entries(catSpend)
      .map(([name, spend]) => ({ name, spend: Math.round(spend * 100) / 100, count: catCount[name] }))
      .sort((a, b) => b.spend - a.spend),
    day_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map(d => ({ day: d, spend: Math.round((dowSpend[d] || 0) * 100) / 100, count: dowCount[d] || 0 })),
    hour_of_day: Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      spend: Math.round((hourSpend[h] || 0) * 100) / 100,
      count: hourCount[h] || 0,
    })),
    top_items: topItems.map(i => ({
      product: i.product,
      total: i.total,
      date: i.date,
      category: i.category,
    })),
    order_types: Object.entries(typeSpend)
      .map(([type, spend]) => ({ type, spend: Math.round(spend * 100) / 100, count: typeCount[type] }))
      .sort((a, b) => b.spend - a.spend),
    refund_reasons: Object.entries(refundReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    refund_by_year: Object.keys(refundByYear).map(Number).sort()
      .map(y => ({ year: y, amount: Math.round(refundByYear[y] * 100) / 100 })),
    all_orders: orders
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(o => ({
        date: o.date,
        product: o.product,
        total: o.total,
        category: o.category,
        type: o.type,
        is_sns: !!o.is_sns,
      })),
    // Subscribe & Save data
    subscribe_save: {
      total_spend: Math.round(snsTotalSpend * 100) / 100,
      total_count: snsOrders.length,
      pct_of_total: totalSpend > 0 ? Math.round((snsTotalSpend / totalSpend) * 1000) / 10 : 0,
      by_year: Object.keys(snsByYear).map(Number).sort()
        .map(y => ({ year: y, spend: Math.round(snsByYear[y] * 100) / 100, count: snsByYearCount[y] || 0 })),
      top_products: topSnsProducts,
      monthly: Object.keys(snsMonthlySpend).sort()
        .map(m => ({ month: m, spend: Math.round(snsMonthlySpend[m] * 100) / 100, count: snsMonthlyCount[m] || 0 })),
    },
  };
}

// ── Main entry point ──
// files: Map<filename, textContent>
// Expected keys: "Order History.csv", "Digital Content Orders.csv", "Refund Details.csv"
function processAmazonData(files) {
  let orders = [];
  let refunds = [];

  // Parse physical orders
  const orderHistoryCSV = files.get('Order History.csv');
  if (orderHistoryCSV) {
    orders = orders.concat(parsePhysicalOrders(orderHistoryCSV));
  }

  // Parse digital orders
  const digitalCSV = files.get('Digital Content Orders.csv');
  if (digitalCSV) {
    orders = orders.concat(parseDigitalOrders(digitalCSV));
  }

  // Parse refunds
  const refundCSV = files.get('Refund Details.csv');
  if (refundCSV) {
    refunds = parseRefunds(refundCSV);
  }

  if (orders.length === 0) {
    throw new Error('No orders found. Please make sure you uploaded the correct Amazon data export files.');
  }

  return buildAggregatedData(orders, refunds);
}

// Export for use in app.js
window.processAmazonData = processAmazonData;
