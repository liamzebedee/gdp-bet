#!/usr/bin/env node
/**
 * Script to extract contract ABIs and addresses from Foundry build artifacts
 * Generates a contracts.js file for easy frontend import
 */

const fs = require('fs');
const path = require('path');

const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const OUT_DIR = path.join(CONTRACTS_DIR, 'out');
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// Contract names and their build artifact paths
const CONTRACTS = {
  GDPMarket: 'GDPMarket.sol/GDPMarket.json',
  LongToken: 'LongToken.sol/LongToken.json',
  ShortToken: 'ShortToken.sol/ShortToken.json',
  USGDPOracle: 'USGDPOracle.sol/USGDPOracle.json',
  MockUSDC: 'MockUSDC.sol/MockUSDC.json',
  MockGDPOracle: 'MockGDPOracle.sol/MockGDPOracle.json'
};

// Read deployment addresses if they exist
function readDeploymentAddresses() {
  const deploymentPath = path.join(CONTRACTS_DIR, 'deployments');
  const addresses = {};
  
  try {
    const files = fs.readdirSync(deploymentPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(fs.readFileSync(path.join(deploymentPath, file), 'utf8'));
        Object.assign(addresses, content);
      }
    }
  } catch (error) {
    console.log('No deployment addresses found, using placeholder addresses');
  }
  
  return addresses;
}

function extractContractData() {
  const contractData = {};
  const deploymentAddresses = readDeploymentAddresses();
  
  for (const [contractName, artifactPath] of Object.entries(CONTRACTS)) {
    try {
      const fullPath = path.join(OUT_DIR, artifactPath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: ${artifactPath} not found, skipping ${contractName}`);
        continue;
      }
      
      const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      
      contractData[contractName] = {
        abi: artifact.abi,
        bytecode: artifact.bytecode?.object || artifact.bytecode,
        address: deploymentAddresses[contractName] || null
      };
      
      console.log(`✓ Extracted ${contractName}`);
    } catch (error) {
      console.error(`Error processing ${contractName}:`, error.message);
    }
  }
  
  return contractData;
}

function generateContractsFile(contractData) {
  const output = `// Auto-generated file - do not edit manually
// Generated on ${new Date().toISOString()}

${Object.entries(contractData)
  .map(([name, data]) => `
export const ${name}_ABI = ${JSON.stringify(data.abi, null, 2)};

export const ${name}_BYTECODE = ${JSON.stringify(data.bytecode)};

export const ${name}_ADDRESS = ${JSON.stringify(data.address)};
`)
  .join('\n')}

// Contract addresses object
export const CONTRACTS = {
${Object.entries(contractData)
  .map(([name, data]) => `  ${name}: {
    abi: ${name}_ABI,
    bytecode: ${name}_BYTECODE,
    address: ${name}_ADDRESS
  }`)
  .join(',\n')}
};

// Network configuration
export const NETWORK_CONFIG = {
  chainId: 31337, // Anvil default
  name: 'Anvil',
  rpcUrl: 'http://localhost:8545'
};

export default CONTRACTS;
`;
  
  // Ensure frontend directory exists
  if (!fs.existsSync(FRONTEND_DIR)) {
    fs.mkdirSync(FRONTEND_DIR, { recursive: true });
  }
  
  const outputPath = path.join(FRONTEND_DIR, 'contracts.js');
  fs.writeFileSync(outputPath, output);
  
  console.log(`✓ Generated ${outputPath}`);
  console.log(`✓ Exported ${Object.keys(contractData).length} contracts`);
}

function main() {
  console.log('Extracting contract ABIs and addresses...');
  
  if (!fs.existsSync(OUT_DIR)) {
    console.error('Error: Foundry out directory not found. Please run "forge build" first.');
    process.exit(1);
  }
  
  const contractData = extractContractData();
  
  if (Object.keys(contractData).length === 0) {
    console.error('Error: No contracts found to extract');
    process.exit(1);
  }
  
  generateContractsFile(contractData);
  
  console.log('\nDone! Import contracts in your frontend like this:');
  console.log('import { CONTRACTS, GDPMarket_ABI, GDPMarket_ADDRESS } from "./contracts.js";');
}

if (require.main === module) {
  main();
}

module.exports = { extractContractData, generateContractsFile };