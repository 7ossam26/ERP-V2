const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.resolve(BACKEND_ROOT, '../frontend');
const FRONTEND_DIST = path.resolve(FRONTEND_ROOT, 'dist');
const BACKEND_PUBLIC = path.resolve(BACKEND_ROOT, 'client_dist');

console.log('🚀 Starting Production Build Preparation...');

try {
    // 1. Build Frontend
    console.log('\n📦 Building Frontend...');
    console.log(`   Path: ${FRONTEND_ROOT}`);

    // Check if frontend exists
    if (!fs.existsSync(FRONTEND_ROOT)) {
        throw new Error(`Frontend directory not found at: ${FRONTEND_ROOT}`);
    }

    // Install deps if needed (optional, safer to assume they exist or let user handle)
    // execSync('npm install', { cwd: FRONTEND_ROOT, stdio: 'inherit' });

    // Run Build
    execSync('npm run build', { cwd: FRONTEND_ROOT, stdio: 'inherit' });

    // 2. Prepare Backend Public Directory
    console.log('\n📂 Preparing Backend Static Directory...');

    if (fs.existsSync(BACKEND_PUBLIC)) {
        console.log(`   Cleaning existing directory: ${BACKEND_PUBLIC}`);
        fs.rmSync(BACKEND_PUBLIC, { recursive: true, force: true });
    }

    fs.mkdirSync(BACKEND_PUBLIC);

    // 3. Copy Build Files
    console.log('\n🚚 Copying Build Files...');

    if (!fs.existsSync(FRONTEND_DIST)) {
        throw new Error('Frontend build directory (dist) missing after build!');
    }

    // Recursive copy function
    function copyRecursiveSync(src, dest) {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();

        if (isDirectory) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest);
            fs.readdirSync(src).forEach((childItemName) => {
                copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    }

    copyRecursiveSync(FRONTEND_DIST, BACKEND_PUBLIC);

    console.log('\n✅ Setup Complete!');
    console.log(`   Frontend built and copied to: ${BACKEND_PUBLIC}`);
    console.log('   You can now start the backend with: npm run start:prod');

} catch (error) {
    console.error('\n❌ Build Failed:');
    console.error(error.message);
    process.exit(1);
}
