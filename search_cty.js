import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function searchCtyDat() {
  const ctyDatPath = path.join(__dirname, 'cty.dat');
  if (!fs.existsSync(ctyDatPath)) {
    console.warn('cty.dat file not found');
    return;
  }
  
  const content = fs.readFileSync(ctyDatPath, 'utf8');
  const lines = content.split('\n');
  
  console.log('Searching for China and United States in cty.dat...');
  
  let foundChina = false;
  let foundUSA = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('China') && !line.startsWith('=')) {
      foundChina = true;
      console.log(`\nFound China at line ${i+1}:`);
      console.log(`Line ${i+1}: ${line}`);
      // 显示接下来的5行，看前缀
      for (let j = i+1; j < Math.min(i+6, lines.length); j++) {
        const prefixLine = lines[j].trim();
        if (prefixLine.startsWith('=')) {
          console.log(`Prefix line ${j+1}: ${prefixLine}`);
        } else if (prefixLine && !prefixLine.startsWith('#')) {
          break; // 遇到新的DXCC记录，停止
        }
      }
    }
    
    if (line.includes('United States') && !line.startsWith('=')) {
      foundUSA = true;
      console.log(`\nFound United States at line ${i+1}:`);
      console.log(`Line ${i+1}: ${line}`);
      // 显示接下来的5行，看前缀
      for (let j = i+1; j < Math.min(i+6, lines.length); j++) {
        const prefixLine = lines[j].trim();
        if (prefixLine.startsWith('=')) {
          console.log(`Prefix line ${j+1}: ${prefixLine}`);
        } else if (prefixLine && !prefixLine.startsWith('#')) {
          break; // 遇到新的DXCC记录，停止
        }
      }
    }
    
    // 如果两个都找到了，就提前结束
    if (foundChina && foundUSA) {
      break;
    }
  }
  
  console.log('\nSearch completed.');
}

searchCtyDat();