import { hdWalletProvider, web3Instance } from './common';

async function run() {
    for (let i = 0; i < 10; i++) {
        const add = hdWalletProvider.getAddress(i);
        const balance = await web3Instance.eth.getBalance(add);
        console.log(`${add}, ${balance}`);
    }
}

run();