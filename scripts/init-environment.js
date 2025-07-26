#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options }).trim();
  } catch (error) {
    if (!options.silent) {
      console.error(`Error executing: ${command}`);
      console.error(error.message);
    }
    return null;
  }
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function compareVersions(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  
  return 0;
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  const checks = {
    'Node.js': {
      command: 'node --version',
      minVersion: '18.0.0',
      currentVersion: null
    },
    'npm': {
      command: 'npm --version', 
      minVersion: '8.0.0',
      currentVersion: null
    },
    'Git': {
      command: 'git --version',
      minVersion: '2.0.0',
      currentVersion: null
    },
    'Wrangler': {
      command: 'wrangler --version',
      minVersion: '3.0.0',
      currentVersion: null
    }
  };
  
  let allPassed = true;
  
  for (const [tool, check] of Object.entries(checks)) {
    const version = exec(check.command, { silent: true });
    check.currentVersion = version;
    
    if (!version) {
      console.log(`❌ ${tool}: Not installed`);
      if (tool === 'Wrangler') {
        console.log('   💡 Run: npm install -g wrangler');
      }
      allPassed = false;
    } else {
      const versionNumber = version.replace(/[^0-9.]/g, '');
      if (compareVersions(versionNumber, check.minVersion) < 0) {
        console.log(`⚠️  ${tool}: ${version} (minimum required: ${check.minVersion})`);
        allPassed = false;
      } else {
        console.log(`✅ ${tool}: ${version}`);
      }
    }
  }
  
  console.log();
  return allPassed;
}

async function checkGitRepository() {
  console.log('📂 Checking Git repository...\n');
  
  const origin = exec('git config --get remote.origin.url', { silent: true });
  if (!origin) {
    console.log('❌ No Git remote origin configured');
    console.log('   💡 Initialize with: git remote add origin <your-repo-url>');
    return false;
  }
  
  console.log(`✅ Repository: ${origin}`);
  
  // Check if we can access the repository
  const hasAccess = exec('git ls-remote --heads origin', { silent: true });
  if (!hasAccess) {
    console.log('❌ Cannot access Git repository');
    console.log('   💡 Check your Git credentials and repository access');
    return false;
  }
  
  console.log('✅ Git repository access confirmed');
  console.log();
  return true;
}

async function checkCloudflare() {
  console.log('☁️  Checking Cloudflare setup...\n');
  
  // Check for environment variables first
  const hasEnvVars = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID;
  if (hasEnvVars) {
    console.log('✅ Using Cloudflare environment variables');
    console.log(`   API Token: ${process.env.CLOUDFLARE_API_TOKEN.substring(0, 10)}...`);
    console.log(`   Account ID: ${process.env.CLOUDFLARE_ACCOUNT_ID}`);
    console.log();
    return true;
  }
  
  // Fall back to wrangler authentication
  const whoami = exec('wrangler whoami', { silent: true });
  if (!whoami || whoami.includes('not logged in') || whoami.includes('not authenticated')) {
    console.log('❌ Not logged in to Cloudflare');
    console.log('   💡 Run: wrangler login');
    console.log('   💡 Or set environment variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID');
    return false;
  }
  
  console.log(`✅ Logged in to Cloudflare via wrangler`);
  console.log(`   Account: ${whoami}`);
  console.log();
  return true;
}

async function checkEnvironmentFiles() {
  console.log('📄 Checking environment files...\n');
  
  const requiredFiles = [
    'wrangler.dev.toml',
    'wrangler.qa.toml', 
    'wrangler.prod.toml',
    'package.json'
  ];
  
  let allExist = true;
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} not found`);
      allExist = false;
    }
  }
  
  // Check for worker-config.json or suggest creation
  if (fs.existsSync('worker-config.json')) {
    console.log('✅ worker-config.json exists');
  } else {
    console.log('ℹ️  worker-config.json not found (optional)');
    console.log('   💡 Create one to simplify URL configuration');
  }
  
  console.log();
  return allExist;
}

async function checkWorkers() {
  console.log('🔧 Checking Cloudflare Workers...\n');
  
  // Try to get config from worker-config.json
  let serviceName = 'your-service';
  let accountId = 'YOUR_ACCOUNT_ID';
  let hasConfig = false;
  
  try {
    if (fs.existsSync('worker-config.json')) {
      const config = JSON.parse(fs.readFileSync('worker-config.json', 'utf8'));
      serviceName = config.serviceName || serviceName;
      accountId = config.accountId || accountId;
      hasConfig = true;
    } else if (fs.existsSync('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      serviceName = pkg.name || serviceName;
    }
  } catch (error) {
    // Use defaults
  }
  
  const workersList = exec('wrangler list', { silent: true });
  if (!workersList) {
    console.log('❌ Cannot list Cloudflare Workers');
    console.log('   💡 Check your Cloudflare authentication');
    return false;
  }
  
  const expectedWorkers = [
    `${serviceName}-dev`,
    `${serviceName}-qa`, 
    `${serviceName}-prod`
  ];
  
  let workersExist = 0;
  for (const workerName of expectedWorkers) {
    if (workersList.includes(workerName)) {
      console.log(`✅ Worker exists: ${workerName}`);
      workersExist++;
    } else {
      console.log(`❌ Worker not found: ${workerName}`);
    }
  }
  
  if (workersExist === 0) {
    console.log('\n💡 No workers found. Create them with:');
    for (const workerName of expectedWorkers) {
      console.log(`   wrangler deploy --name ${workerName} --account-id ${accountId} --compatibility-date 2025-01-01 <<< 'export default { fetch() { return new Response("Hello!"); } }'`);
    }
    
    // Offer automatic provisioning if we have complete config
    if (hasConfig && accountId !== 'YOUR_ACCOUNT_ID') {
      const answer = await question('\nWould you like to create these workers automatically? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        await provisionWorkers(serviceName, accountId, expectedWorkers);
        workersExist = expectedWorkers.length; // Update the count after successful provisioning
      }
    } else if (!hasConfig) {
      console.log('\n💡 Create worker-config.json with serviceName and accountId for automatic provisioning');
    } else if (accountId === 'YOUR_ACCOUNT_ID') {
      console.log('\n💡 Update accountId in worker-config.json for automatic provisioning');
    }
  }
  
  console.log();
  return workersExist === expectedWorkers.length;
}

async function provisionWorkers(serviceName, accountId, expectedWorkers) {
  console.log('\n🏗️  Provisioning Cloudflare Workers...');
  
  const environments = [
    { name: 'dev', message: 'Hello dev!' },
    { name: 'qa', message: 'Hello qa!' },
    { name: 'prod', message: 'Hello production!' }
  ];
  
  for (let i = 0; i < expectedWorkers.length; i++) {
    const workerName = expectedWorkers[i];
    const env = environments[i];
    
    console.log(`📦 Creating worker: ${workerName}`);
    
    const workerCode = `export default { fetch() { return new Response("${env.message}"); } }`;
    const tempFile = `temp-worker-${env.name}.js`;
    
    try {
      // Write temp file
      fs.writeFileSync(tempFile, workerCode);
      
      // Deploy worker
      exec(`wrangler deploy ${tempFile} --name ${workerName} --account-id ${accountId} --compatibility-date 2025-01-01`);
      console.log(`✅ Created: ${workerName}`);
      
    } catch (error) {
      console.error(`❌ Failed to create ${workerName}:`, error.message);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
  
  console.log('\n🎉 Worker provisioning complete!');
}

async function createWranglerConfigs(serviceName) {
  console.log('\n📄 Creating wrangler configuration files...');
  
  const configs = [
    { env: 'dev', name: `${serviceName}-dev` },
    { env: 'qa', name: `${serviceName}-qa` },
    { env: 'prod', name: `${serviceName}-prod` }
  ];
  
  for (const config of configs) {
    const filename = `wrangler.${config.env}.toml`;
    
    if (fs.existsSync(filename)) {
      console.log(`ℹ️  ${filename} already exists, skipping...`);
      continue;
    }
    
    const content = `name = "${config.name}"
main = "dist/index.js"
compatibility_date = "2025-01-01"

# Add your ${config.env} environment-specific configuration here
# [vars]
# ENVIRONMENT = "${config.env}"

# Uncomment and configure if you need KV namespaces
# [[kv_namespaces]]
# binding = "MY_KV"
# id = "your-${config.env}-kv-namespace-id"

# Uncomment and configure if you need R2 buckets
# [[r2_buckets]]
# binding = "MY_BUCKET"
# bucket_name = "${serviceName}-${config.env}-bucket"
`;
    
    try {
      fs.writeFileSync(filename, content);
      console.log(`✅ Created: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to create ${filename}:`, error.message);
    }
  }
}

async function updateWorkflowFiles(serviceName, workersDomain) {
  console.log('\n📝 Updating GitHub Actions workflow files...');
  
  const workflowFiles = [
    '.github/workflows/deploy-dev.yml',
    '.github/workflows/deploy-qa.yml',
    '.github/workflows/deploy-prod.yml'
  ];
  
  for (const file of workflowFiles) {
    if (fs.existsSync(file)) {
      try {
        let content = fs.readFileSync(file, 'utf8');
        
        // Update service name and domain
        content = content.replace(/service_name: my-service/g, `service_name: ${serviceName}`);
        content = content.replace(/workers_domain: 'my-domain\.workers\.dev'/g, `workers_domain: '${workersDomain}'`);
        
        fs.writeFileSync(file, content);
        console.log(`✅ Updated: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to update ${file}:`, error.message);
      }
    } else {
      console.log(`ℹ️  File not found: ${file}`);
    }
  }
}

async function checkPackageScripts() {
  console.log('📦 Checking package.json scripts...\n');
  
  if (!fs.existsSync('package.json')) {
    console.log('❌ package.json not found');
    return false;
  }
  
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const scripts = pkg.scripts || {};
  
  const requiredScripts = [
    'build',
    'tag:create',
    'tag:status'
  ];
  
  const recommendedScripts = [
    'build:dev',
    'build:qa',
    'build:prod'
  ];
  
  let hasRequired = true;
  
  for (const script of requiredScripts) {
    if (scripts[script]) {
      console.log(`✅ Script exists: ${script}`);
    } else {
      console.log(`❌ Missing required script: ${script}`);
      hasRequired = false;
    }
  }
  
  for (const script of recommendedScripts) {
    if (scripts[script]) {
      console.log(`✅ Script exists: ${script}`);
    } else {
      console.log(`ℹ️  Recommended script missing: ${script}`);
    }
  }
  
  console.log();
  return hasRequired;
}

async function showNextSteps() {
  console.log('\n📋 Next Steps:\n');
  
  console.log('1. Configure GitHub repository secrets:');
  console.log('   - CLOUDFLARE_API_TOKEN');
  console.log('   - CLOUDFLARE_ACCOUNT_ID\n');
  
  console.log('2. Test development deployment:');
  console.log('   git push origin main\n');
  
  console.log('3. Create QA deployment:');
  console.log('   npm run tag:create\n');
  
  console.log('4. Check deployment status:');
  console.log('   npm run tag:status\n');
  
  console.log('For more details, see the README.md file');
}

async function main() {
  console.log('🚀 Cloudflare Workers Environment Validation\n');
  
  try {
    const prerequisitesPassed = await checkPrerequisites();
    if (!prerequisitesPassed) {
      console.log('\n⚠️  Please install missing prerequisites before continuing.');
      process.exit(1);
    }
    
    const gitOk = await checkGitRepository();
    if (!gitOk) {
      console.log('\n⚠️  Please configure Git repository access before continuing.');
      process.exit(1);
    }
    
    const cloudflareOk = await checkCloudflare();
    if (!cloudflareOk) {
      const answer = await question('\nWould you like to login to Cloudflare now? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        console.log('\nOpening Cloudflare login...');
        exec('wrangler login');
        console.log('\nPlease complete the login process and run this script again.');
      }
      process.exit(1);
    }
    
    const envFilesOk = await checkEnvironmentFiles();
    if (!envFilesOk) {
      console.log('\n⚠️  Required files are missing. Please create them before continuing.');
      process.exit(1);
    }
    
    const workersOk = await checkWorkers();
    if (!workersOk) {
      console.log('\n⚠️  Some Cloudflare Workers are missing. Please create them before continuing.');
    }
    
    const scriptsOk = await checkPackageScripts();
    if (!scriptsOk) {
      console.log('\n⚠️  Required package.json scripts are missing. Please add them before continuing.');
    }
    
    // Offer to create/update files if config exists
    if (fs.existsSync('worker-config.json')) {
      try {
        const config = JSON.parse(fs.readFileSync('worker-config.json', 'utf8'));
        if (config.serviceName) {
          // Offer to create wrangler configs
          const needsWranglerConfigs = !fs.existsSync('wrangler.dev.toml') || 
                                     !fs.existsSync('wrangler.qa.toml') || 
                                     !fs.existsSync('wrangler.prod.toml');
          
          if (needsWranglerConfigs) {
            const answer = await question('\nWould you like to create missing wrangler configuration files? (y/n): ');
            if (answer.toLowerCase() === 'y') {
              await createWranglerConfigs(config.serviceName);
            }
          }
          
          // Offer to update workflow files
          if (config.workersDomain) {
            const answer = await question('\nWould you like to update GitHub Actions workflow files with your configuration? (y/n): ');
            if (answer.toLowerCase() === 'y') {
              await updateWorkflowFiles(config.serviceName, config.workersDomain);
            }
          }
        }
      } catch (error) {
        // Ignore config errors
      }
    }
    
    if (workersOk && scriptsOk) {
      console.log('\n✅ Environment validation complete! Everything looks good.');
    } else {
      console.log('\n⚠️  Environment validation completed with warnings. Please address the issues above.');
    }
    
    await showNextSteps();
    
  } catch (error) {
    console.error('\n❌ Error during validation:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();