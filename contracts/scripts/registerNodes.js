const hre = require("hardhat");

async function main() {
    const contractAddress = require("fs").readFileSync(
        require("path").join(__dirname, "..", "..", "backend", "contract_address.txt"),
        "utf8"
    ).trim();

    const contract = await hre.ethers.getContractAt("TrainingVerification", contractAddress);
    const signers = await hre.ethers.getSigners();

    const nodesToRegister = signers.slice(1, 6);
    for (const node of nodesToRegister) {
        const tx = await contract.registerNode(node.address);
        await tx.wait();
        console.log("Registered Node:", node.address);
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});