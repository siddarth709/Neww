const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account", deployer.address);
    const TrainingVerification = await hre.ethers.getContractFactory("TrainingVerification");
    const contract = await TrainingVerification.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log("TrainingVerification deployed to:", address);
    const artifact = await hre.artifacts.readArtifact("TrainingVerification");
    const outDir = path.join(__dirname, "..", "..", "backend");
    fs.writeFileSync(
        path.join(outDir, "TrainingVerification.abi.json"),
        JSON.stringify(artifact.abi, null, 2)

    );
    fs.writeFileSync(
        path.join(outDir, "contract_address.txt"),
        address,
    );
    console.log("ABI + address written to backend/ - set CONTRACT_ADDRESS in your .env");
}
main().catch((err) => {
    console.error(err);
    process.exitcode = 1;
});

