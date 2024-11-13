"use client";

import { MyHoldings } from "./_components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";
import { useState } from "react";

const MyNFTs: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();

  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  // 使用 BigInt 来处理版税百分比
  const [royaltyPercentage, setRoyaltyPercentage] = useState<BigInt>(BigInt(10)); // 默认版税1%

  const handleMintItem = async () => {
    if (tokenIdCounter === undefined) return;

    const tokenIdCounterNumber = Number(tokenIdCounter);
    const currentTokenMetaData = nftsMetadata[tokenIdCounterNumber % nftsMetadata.length];
    const notificationId = notification.loading("Uploading to IPFS");

    try {
      // 上传到IPFS
      const uploadedItem = await addToIPFS(currentTokenMetaData);

      // 清除加载通知并显示成功通知
      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      // 版税接收地址是当前连接的地址
      const royaltyRecipient = connectedAddress;

      // 调用合约 mintItem 函数，传递四个参数
      await writeContractAsync({
        functionName: "mintItem",
        args: [
          connectedAddress, 
          uploadedItem.IpfsHash, 
          royaltyRecipient, 
          BigInt(royaltyPercentage.toString())  // 将 BigInt 转换为 string 传递
        ],
      });
    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
    }
  };

  // 处理版税百分比输入
  const handleRoyaltyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = BigInt(e.target.value); // 转换为 BigInt
    if (value >= BigInt(0) && value <= BigInt(1000)) {
      setRoyaltyPercentage(value);  // 保持 BigInt 类型
    } else {
      // 输入无效时，可以选择显示一个提示信息
      console.log("Invalid royalty percentage, it must be between 0 and 1000.");
    }
  };

  return (
    <>
      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">My NFTs</span>
          </h1>
        </div>
      </div>
      <div className="flex justify-center mb-4">
        {/* 连接钱包后显示铸造按钮 */}
        {!isConnected || isConnecting ? (
          <RainbowKitCustomConnectButton />
        ) : (
          <>
            {/* 版税百分比输入框 */}
            <input
              type="number"
              value={royaltyPercentage.toString()}  // 显示 BigInt 为字符串
              onChange={handleRoyaltyChange}
              min="0"
              max="1000"
              className="input input-bordered mr-4"
              placeholder="Royalty Percentage (0 - 1000)"
            />
            <button className="btn btn-secondary" onClick={handleMintItem}>
              Mint NFT
            </button>
          </>
        )}
      </div>
      <MyHoldings />
    </>
  );
};

export default MyNFTs;