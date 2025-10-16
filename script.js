// Helper function to parse data URLs
function parseDataUrl(url) {
  if (!url.startsWith('data:')) {
    throw new Error('Invalid data URL');
  }
  
  const commaIndex = url.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Invalid data URL format');
  }
  
  const header = url.substring(5, commaIndex); // Remove 'data:' prefix
  const payload = url.substring(commaIndex + 1);
  
  const parts = header.split(';');
  const mime = parts[0] || 'text/plain';
  const isBase64 = parts.includes('base64');
  
  return { mime, isBase64, payload };
}

// Helper function to decode base64 to text
function decodeBase64ToText(b64) {
  try {
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (e) {
    throw new Error('Failed to decode base64 data');
  }
}

// Helper function to parse CSV text
function parseCsv(text) {
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Detect delimiter
  const delimiters = [',', ';', '\t'];
  let delimiter = ',';
  let maxSeparators = 0;
  
  for (const delim of delimiters) {
    const count = (text.indexOf('\n') !== -1 ? text.substring(0, text.indexOf('\n')) : text).split(delim).length;
    if (count > maxSeparators) {
      maxSeparators = count;
      delimiter = delim;
    }
  }
  
  // Split into lines
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // Check if first row is header (contains non-numeric values)
  const firstRow = lines[0].split(delimiter);
  const isHeader = firstRow.some(cell => isNaN(parseFloat(cell.trim())));
  
  const headers = isHeader ? firstRow.map(h => h.trim()) : null;
  const dataLines = isHeader ? lines.slice(1) : lines;
  
  const rows = dataLines.map(line => {
    // Handle quoted fields
    const regex = new RegExp(`${delimiter}(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)`);
    return line.split(regex).map(cell => {
      // Remove quotes and trim
      return cell.trim().replace(/^"|"$/g, '');
    });
  });
  
  return { headers, rows };
}

// Function to fetch and process CSV data
async function processSalesData() {
  const totalSalesElement = document.getElementById('total-sales');
  const errorMessageElement = document.getElementById('error-message');
  const productSalesTable = document.getElementById('product-sales').getElementsByTagName('tbody')[0];
  
  try {
    // Attachment URL from the brief
    const attachmentUrl = "data:text/csv;base64,UHJvZHVjdHMsU2FsZXMKUGhvbmVzLDEwMDAKQm9va3MsMTIzLjQ1Ck5vdGVib29rcywxMTEuMTEK";
    
    let csvText;
    
    if (attachmentUrl.startsWith('data:')) {
      // Parse data URL
      const { mime, isBase64, payload } = parseDataUrl(attachmentUrl);
      
      if (!mime.includes('csv')) {
        throw new Error('Invalid MIME type for CSV data');
      }
      
      if (isBase64) {
        csvText = decodeBase64ToText(payload);
      } else {
        csvText = decodeURIComponent(payload);
      }
    } else {
      // Handle HTTP URLs
      const response = await fetch(attachmentUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      csvText = await response.text();
    }
    
    // Parse CSV
    const { headers, rows } = parseCsv(csvText);
    
    // Find sales column (case-insensitive)
    let salesColumnIndex = -1;
    let productColumnIndex = -1;
    if (headers) {
      salesColumnIndex = headers.findIndex(header => 
        header.toLowerCase().includes('sales') || header.toLowerCase().includes('sale')
      );
      productColumnIndex = headers.findIndex(header => 
        header.toLowerCase().includes('product')
      );
    }
    
    // If no header or sales column not found, assume second column
    if (salesColumnIndex === -1) {
      salesColumnIndex = 1;
    }
    
    // If no header or product column not found, assume first column
    if (productColumnIndex === -1) {
      productColumnIndex = 0;
    }
    
    // Calculate total sales and populate product sales table
    let totalSales = 0;
    productSalesTable.innerHTML = '';
    
    for (const row of rows) {
      if (row.length > Math.max(salesColumnIndex, productColumnIndex)) {
        const product = row[productColumnIndex];
        const value = parseFloat(row[salesColumnIndex]);
        
        if (!isNaN(value)) {
          totalSales += value;
          
          // Add row to product sales table
          const tr = document.createElement('tr');
          const productTd = document.createElement('td');
          const salesTd = document.createElement('td');
          
          productTd.textContent = product;
          salesTd.textContent = value.toFixed(2);
          
          tr.appendChild(productTd);
          tr.appendChild(salesTd);
          productSalesTable.appendChild(tr);
        }
      }
    }
    
    // Display total sales
    totalSalesElement.textContent = totalSales.toFixed(2);
    totalSalesElement.classList.add('text-success');
    
    // Hide any previous error
    errorMessageElement.classList.add('d-none');
  } catch (error) {
    // Display error message
    errorMessageElement.textContent = `Error: ${error.message}`;
    errorMessageElement.classList.remove('d-none');
    totalSalesElement.textContent = 'Error';
    totalSalesElement.classList.add('text-danger');
    console.error('Error processing sales data:', error);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', processSalesData);