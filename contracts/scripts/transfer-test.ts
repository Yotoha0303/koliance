import { network } from "hardhat";
import { parseEther, isAddress } from "viem";

async function main() {
  const contractAddress = process.env.KOL_CONTRACT_ADDRESS;
  const recipient = process.env.TARGET_RECIPIENT;
  const transferAmount = process.env.TRANSFER_AMOUNT || "1.0"; // 默认 1 枚

  if (!contractAddress || !isAddress(contractAddress)) {
    console.error("❌ 请先设置环境变量 KOL_CONTRACT_ADDRESS 为已部署的 KolToken 合约地址！");
    process.exit(1);
  }

  const { viem } = await network.getOrCreate();
  const [sender] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log(`\n🌐 当前网络: ${network.name}`);
  console.log(`👤 操作账户: ${sender.account.address}`);
  console.log(`📍 KolToken 合约: ${contractAddress}`);

  const kolToken = await viem.getContractAt("KolToken", contractAddress);

  // 1. 尝试占领区块领取奖励
  console.log("\n⛏️ 正在尝试调用 claimBlockReward() 占领区块并领取奖励...");
  try {
    const claimTx = await kolToken.write.claimBlockReward();
    console.log(`✅ 占领区块成功！Tx Hash: ${claimTx}`);
  } catch (err: any) {
    console.log(`ℹ️ 当前无需领取或跳过: ${err?.shortMessage || err?.message || err}`);
  }

  // 2. 查看当前代币余额
  const tokenBal = await kolToken.read.balanceOf([sender.account.address]);
  const monBal = await publicClient.getBalance({ address: sender.account.address });
  console.log(`💰 当前 MON 余额: ${Number(monBal) / 1e18} MON`);
  console.log(`💰 当前 ICON 余额: ${Number(tokenBal) / 1e18} ICON`);

  // 3. 如果提供了转账目标，测试 ICON 转账和 MON 转账
  if (recipient && isAddress(recipient)) {
    console.log(`\n📤 准备向目标地址转账: ${recipient}`);

    // 转账 ICON 代币
    const tokenAmountWei = parseEther(transferAmount);
    if (tokenBal >= tokenAmountWei) {
      console.log(`🔄 正在转账 ${transferAmount} ICON...`);
      const tx = await kolToken.write.transfer([recipient, tokenAmountWei]);
      console.log(`✅ ICON 转账成功！Tx Hash: ${tx}`);
    } else {
      console.log(`⚠️ ICON 余额不足 ${transferAmount}，跳过代币转账。`);
    }

    // 转账少许原生 MON (0.001 MON)
    const monSendAmount = parseEther("0.001");
    if (monBal > monSendAmount) {
      console.log(`🔄 正在转账 0.001 MON (原生 Gas 币)...`);
      const monTx = await sender.sendTransaction({
        to: recipient,
        value: monSendAmount,
      });
      console.log(`✅ MON 原生转账成功！Tx Hash: ${monTx}`);
    }
  } else {
    console.log("\n💡 提示: 设置环境变量 TARGET_RECIPIENT=0x... 可一键测试转账。");
  }
}

main().catch((error) => {
  console.error("❌ 执行出错:", error);
  process.exitCode = 1;
});
