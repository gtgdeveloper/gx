
require('dotenv').config();
const https = require('https');
const web3 = require('@solana/web3.js');
const bs58 = require('bs58');

// Load wallet from environment variable
const secretKey = bs58.decode(process.env.WALLETKEY);
const fromKeypair = web3.Keypair.fromSecretKey(secretKey);

// Custom RPC URL
const rpcUrl = 'https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4';
const connection = new web3.Connection(rpcUrl, 'confirmed');

// GitHub raw JSON
const jsonUrl = 'https://raw.githubusercontent.com/gtgdeveloper/gx/main/gtgsol-5-full.json';

// Fetch and send payments
https.get(jsonUrl, res => {
    let data = '';

    res.on('data', chunk => { data += chunk; });

    res.on('end', async () => {
        try {
            const parsedData = JSON.parse(data);
            await sendSolPayments(parsedData.slice(0, 4)); // Top 4 entries
        } catch (err) {
            console.error('Error parsing JSON:', err.message);
            console.error('Raw response:', data.substring(0, 200) + '...');
        }
    });

}).on('error', err => {
    console.error('Error fetching JSON:', err.message);
});

async function sendSolPayments(entries) {
    console.log('Sending real SOL payments to 4 addresses...\n');
    let totalSol = 0;
    let txCount = 0;

    for (const entry of entries) {
        const recipient = entry.owner;
        const amountSol = entry.daily_sol_for_100_apy;
        const lamports = Math.floor(amountSol * web3.LAMPORTS_PER_SOL);

        try {
            const tx = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                    fromPubkey: fromKeypair.publicKey,
                    toPubkey: new web3.PublicKey(recipient),
                    lamports,
                })
            );

            const signature = await web3.sendAndConfirmTransaction(connection, tx, [fromKeypair]);
            console.log(`✅ Sent ${amountSol.toFixed(9)} SOL to ${recipient} [${signature}]`);
            totalSol += amountSol;
            txCount++;

        } catch (err) {
            console.error(`❌ Failed to send to ${recipient}: ${err.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
    }

    console.log('\nAll done.');
    console.log(`Total Transactions: ${txCount}`);
    console.log(`Total SOL Sent: ${totalSol.toFixed(9)} SOL`);
}
