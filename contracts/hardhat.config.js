require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "");
        if (!process.env[key]) process.env[key] = value;
    }
}

module.exports = {
    solidity: "0.8.24",
    networks: {
        hardhat: { chainId: 31337 },
        localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111,
        },
    },
};
