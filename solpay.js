
// solpay.js
const https = require('https');

const jsonUrl = 'https://raw.githubusercontent.com/gtgdeveloper/gx/main/gtgsol-5-full.json';

https.get(jsonUrl, res => {
    let data = '';

    res.on('data', chunk => { data += chunk; });

    res.on('end', () => {
        try {
            const parsedData = JSON.parse(data);
            simulateSolPayments(parsedData.slice(0, 4)); // Only process first 4 entries
        } catch (err) {
            console.error('Error parsing JSON:', err.message);
            console.error('Raw response:', data.substring(0, 200) + '...');
        }
    });

}).on('error', err => {
    console.error('Error fetching JSON:', err.message);
});

async function simulateSolPayments(entries) {
    console.log('Simulating daily SOL payments to each owner address...\n');
    let totalSol = 0;
    let txCount = 0;

    for (const entry of entries) {
        const owner = entry.owner;
        const dailySol = entry.daily_sol_for_100_apy;

        console.log(`Sending ${dailySol.toFixed(9)} SOL to ${owner}`);
        totalSol += dailySol;
        txCount++;

        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }

    console.log('\nSimulation complete.');
    console.log(`Total Transactions: ${txCount}`);
    console.log(`Total SOL Transferred: ${totalSol.toFixed(9)} SOL`);
}
