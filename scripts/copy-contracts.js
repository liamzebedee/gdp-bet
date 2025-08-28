#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const OUT_DIR = path.join(CONTRACTS_DIR, 'out');
const BROADCAST_DIR = path.join(CONTRACTS_DIR, 'broadcast');
const FRONTEND_DIR = path.join(__dirname, '../frontend');
const OUTPUT_FILE = path.join(FRONTEND_DIR, 'contracts.js');

// Contract names we want to include
const CONTRACTS = [
  'GDPMarket',
  'LongToken', 
  'ShortToken',
  'MockUSDC',
  'MockGDPOracle',
  'USGDPOracle'
];

function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to read ${filePath}:`, error.message);
    return null;
  }
}

function extractABI(contractName) {
  const artifactPath = path.join(OUT_DIR, `${contractName}.sol`, `${contractName}.json`);
  const artifact = readJsonFile(artifactPath);
  
  if (!artifact || !artifact.abi) {
    console.warn(`No ABI found for ${contractName}`);
    return null;
  }
  
  return artifact.abi;
}

function getLatestDeployment() {
  try {
    // Look for the most recent deployment
    const deployScript = 'Deploy.s.sol';
    const scriptBroadcastDir = path.join(BROADCAST_DIR, deployScript);
    
    if (!fs.existsSync(scriptBroadcastDir)) {
      console.warn('No broadcast directory found');
      return null;
    }
    
    // Find chain directories (e.g., 31337 for localhost)
    const chainDirs = fs.readdirSync(scriptBroadcastDir)
      .filter(dir => fs.statSync(path.join(scriptBroadcastDir, dir)).isDirectory());
    
    if (chainDirs.length === 0) {
      console.warn('No chain directories found in broadcast');
      return null;
    }
    
    // Use the first chain directory (typically 31337 for localhost)
    const chainId = chainDirs[0];
    const chainDir = path.join(scriptBroadcastDir, chainId);
    
    // Look for run-latest.json first, then any run-*.json files
    let deploymentFile = path.join(chainDir, 'run-latest.json');
    
    if (!fs.existsSync(deploymentFile)) {
      const runFiles = fs.readdirSync(chainDir)
        .filter(file => file.startsWith('run-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Get most recent
      
      if (runFiles.length === 0) {
        console.warn('No deployment files found');
        return null;
      }
      
      deploymentFile = path.join(chainDir, runFiles[0]);
    }
    
    const deployment = readJsonFile(deploymentFile);
    if (!deployment) {
      return null;
    }
    
    return {
      chainId: parseInt(chainId),
      deployment,
      timestamp: deployment.timestamp || Date.now()
    };
    
  } catch (error) {
    console.error('Error reading deployment:', error.message);
    return null;
  }
}

function extractAddresses(deployment) {
  const addresses = {};
  
  if (!deployment || !deployment.transactions) {
    console.warn('No transactions found in deployment');
    return addresses;
  }
  
  for (const tx of deployment.transactions) {
    if (tx.transactionType === 'CREATE' && tx.contractName && tx.contractAddress) {
      addresses[tx.contractName] = tx.contractAddress;
      console.log(`Found ${tx.contractName} at ${tx.contractAddress}`);
    }
  }
  
  return addresses;
}

function generateContractsFile(abis, addresses, chainId) {
  const contractsData = {};
  
  // Add ABIs and addresses for each contract
  CONTRACTS.forEach(contractName => {
    const abi = abis[contractName];
    const address = addresses[contractName];
    
    if (abi || address) {
      contractsData[contractName] = {
        ...(abi && { abi }),
        ...(address && { address }),
      };
    }
  });
  
  // Generate the JavaScript file content
  const content = `// Auto-generated contract data
// Generated on: ${new Date().toISOString()}
// Chain ID: ${chainId || 'unknown'}

${Object.entries(contractsData).map(([name, data]) => {
  let contractCode = `export const ${name} = {\n`;
  
  if (data.address) {
    contractCode += `  address: "${data.address}",\n`;
  }
  
  if (data.abi) {
    contractCode += `  abi: ${JSON.stringify(data.abi, null, 2)}\n`;
  }
  
  contractCode += `};\n`;
  
  return contractCode;
}).join('\n')}

// Contract addresses for easy access
export const ADDRESSES = {
${Object.entries(addresses)
  .filter(([name]) => CONTRACTS.includes(name))
  .map(([name, address]) => `  ${name}: "${address}"`)
  .join(',\n')}
};

// All contract ABIs
export const ABIS = {
${Object.entries(contractsData)
  .filter(([, data]) => data.abi)
  .map(([name]) => `  ${name}: ${name}.abi`)
  .join(',\n')}
};

// Chain configuration
export const CHAIN_ID = ${chainId || 31337};

// Export all contracts
export const CONTRACTS = {
${Object.keys(contractsData).map(name => `  ${name}`).join(',\n  ')}
};
`;
  
  return content;
}

function main() {
  console.log('🔄 Copying contract ABIs and addresses...');
  
  // Create frontend directory if it doesn't exist
  if (!fs.existsSync(FRONTEND_DIR)) {
    fs.mkdirSync(FRONTEND_DIR, { recursive: true });
  }
  
  // Extract ABIs
  const abis = {};
  CONTRACTS.forEach(contractName => {
    const abi = extractABI(contractName);
    if (abi) {
      abis[contractName] = abi;
      console.log(`✅ Extracted ABI for ${contractName}`);
    }
  });
  
  // Extract addresses from latest deployment
  const deploymentInfo = getLatestDeployment();
  const addresses = deploymentInfo ? extractAddresses(deploymentInfo.deployment) : {};
  const chainId = deploymentInfo ? deploymentInfo.chainId : 31337;
  
  if (Object.keys(addresses).length === 0) {
    console.warn('⚠️  No contract addresses found. Run deployment first with: npm run deploy');
  }
  
  // Generate the contracts file
  const contractsFileContent = generateContractsFile(abis, addresses, chainId);
  
  // Write the file
  fs.writeFileSync(OUTPUT_FILE, contractsFileContent);
  
  console.log('✅ Contract data written to:', OUTPUT_FILE);
  console.log('📊 Summary:');
  console.log(`   - ABIs: ${Object.keys(abis).length}`);
  console.log(`   - Addresses: ${Object.keys(addresses).length}`);
  console.log(`   - Chain ID: ${chainId}`);
}

if (require.main === module) {
  main();
}

module.exports = { main };