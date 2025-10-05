/**
 * Complete Global Function Scanner
 * Scans ALL available functions in browser global scope
 */

function scanAllGlobalFunctions() {
    const allFunctions = new Set();
    
    console.log('🔍 Starting complete global function scan...');
    
    // 1. Scan window.*
    console.log('📋 Scanning window properties...');
    Object.getOwnPropertyNames(window).forEach(name => {
        try {
            if (typeof window[name] === 'function') {
                allFunctions.add(`window.${name}`);
            }
        } catch (e) {
            // Some properties might throw errors when accessed
        }
    });
    
    // 2. Scan globalThis.*
    console.log('🌍 Scanning globalThis properties...');
    Object.getOwnPropertyNames(globalThis).forEach(name => {
        try {
            if (typeof globalThis[name] === 'function') {
                if (!allFunctions.has(`window.${name}`)) {
                    allFunctions.add(`global.${name}`);
                }
            }
        } catch (e) {
            // Some properties might throw errors when accessed
        }
    });
    
    // 3. Scan prototype chains of important objects
    console.log('🔗 Scanning prototype chains...');
    const importantObjects = [
        window, document, navigator, location, history, 
        console, performance, crypto, localStorage, sessionStorage
    ];
    
    importantObjects.forEach(obj => {
        if (!obj) return;
        try {
            let current = obj;
            while (current && current !== Object.prototype) {
                Object.getOwnPropertyNames(current).forEach(name => {
                    try {
                        if (typeof obj[name] === 'function') {
                            allFunctions.add(`${obj.constructor.name}.${name}`);
                        }
                    } catch (e) {
                        // Ignore access errors
                    }
                });
                current = Object.getPrototypeOf(current);
            }
        } catch (e) {
            // Ignore prototype traversal errors
        }
    });
    
    // 4. Special VIDAA/TV specific scanning
    console.log('📺 Scanning TV-specific globals...');
    const tvObjects = ['vowOS', 'omi_platform', 'TvInfo_Json'];
    tvObjects.forEach(objName => {
        try {
            const obj = window[objName] || globalThis[objName];
            if (obj && typeof obj === 'object') {
                Object.getOwnPropertyNames(obj).forEach(name => {
                    try {
                        if (typeof obj[name] === 'function') {
                            allFunctions.add(`${objName}.${name}`);
                        }
                    } catch (e) {
                        // Ignore access errors
                    }
                });
            }
        } catch (e) {
            // Object doesn't exist
        }
    });
    
    // 5. Dynamic evaluation scan for hidden functions
    console.log('🔍 Scanning for hidden functions...');
    const commonPrefixes = [
        'Hisense_', 'TvInfo_', 'HiUtils_', 'VOS_', 'omi_',
        'get', 'set', 'is', 'has', 'create', 'init', 'start', 'stop',
        'open', 'close', 'read', 'write', 'load', 'save',
        'webkit', 'moz', 'ms', 'o'  // Browser prefixes
    ];
    
    commonPrefixes.forEach(prefix => {
        for (let i = 0; i < 50; i++) {
            const testNames = [
                `${prefix}${i}`,
                `${prefix}Function`,
                `${prefix}API`,
                `${prefix}Method`,
                `${prefix}Call`
            ];
            
            testNames.forEach(testName => {
                try {
                    if (typeof window[testName] === 'function') {
                        allFunctions.add(`hidden.${testName}`);
                    }
                } catch (e) {
                    // Function doesn't exist
                }
            });
        }
    });
    
    const functionArray = Array.from(allFunctions).sort();
    
    console.log(`✅ Scan complete! Found ${functionArray.length} functions:`);
    console.log('📊 Function categories:');
    
    // Categorize functions
    const categories = {
        vidaa: functionArray.filter(f => f.includes('Hisense_') || f.includes('TvInfo_') || f.includes('HiUtils_')),
        browser: functionArray.filter(f => f.startsWith('window.') && !f.includes('Hisense_')),
        global: functionArray.filter(f => f.startsWith('global.')),
        dom: functionArray.filter(f => f.includes('Element') || f.includes('Node') || f.includes('Document')),
        webkit: functionArray.filter(f => f.includes('webkit') || f.includes('moz') || f.includes('ms')),
        tv: functionArray.filter(f => f.includes('vowOS') || f.includes('omi_platform')),
        hidden: functionArray.filter(f => f.startsWith('hidden.')),
        other: functionArray.filter(f => !f.startsWith('window.') && !f.startsWith('global.') && !f.includes('Hisense_') && !f.startsWith('hidden.'))
    };
    
    Object.entries(categories).forEach(([category, functions]) => {
        if (functions.length > 0) {
            console.log(`  ${category.toUpperCase()}: ${functions.length}`);
        }
    });
    
    // Show first 50 for preview
    console.log('\n🎯 Sample functions (first 50):');
    functionArray.slice(0, 50).forEach((func, i) => {
        console.log(`${i + 1}. ${func}`);
    });
    
    if (functionArray.length > 50) {
        console.log(`... and ${functionArray.length - 50} more!`);
    }
    
    return {
        total: functionArray.length,
        functions: functionArray,
        categories: categories
    };
}

// Auto-execute when loaded
if (typeof window !== 'undefined') {
    console.log('🚀 Starting comprehensive global function scan...');
    const result = scanAllGlobalFunctions();
    
    // Make result available globally
    window.globalScanResult = result;
    
    console.log('\n📋 Results saved to window.globalScanResult');
    console.log('💡 Use window.globalScanResult.functions to see all functions');
    console.log('💡 Use window.globalScanResult.categories to see by category');
}