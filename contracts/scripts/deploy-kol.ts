import { network } from "hardhat";

async function main() {
  const { viem } = await network.getOrCreate();
  const [deployer] = await viem.getWalletClients();

  console.log(`\n🚀 准备在网络 [${network.name}] 部署 KolToken...`);
  console.log(`👤 部署账户: ${deployer.account.address}`);

  const publicClient = await viem.getPublicClient();
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`💰 账户原生币余额: ${balance} wei (${Number(balance) / 1e18} 原生币)`);

  if (balance === 0n) {
    console.warn("⚠️ 警告: 部署账户原生币余额为 0，请先在 Monad Testnet 领取测试币！");
  }

  const kolToken = await viem.deployContract("KolToken");
  console.log(`\n✅ KolToken 部署成功！`);
  console.log(`📍 合约地址: ${kolToken.address}`);
  console.log(`📌 代币名称 (Name): kol`);
  console.log(`📌 代币符号 (Symbol): ICON`);
  console.log(`📌 精度 (Decimals): 18`);
  console.log(`📌 总硬顶 (Max Supply): 2^30 (${2n ** 30n} ICON)`);
  console.log(`\n🔍 在 Monad 浏览器查看: https://testnet.monadexplorer.com/address/${kolToken.address}\n`);
}

main().catch((error) => {
  console.error("❌ 部署失败:", error);
  process.exitCode = 1;
});
