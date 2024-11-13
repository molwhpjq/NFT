"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { create } from "ipfs-http-client"; // 引入IPFS客户端

const MintNFTPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [price, setPrice] = useState<bigint>(0n);
  const [royaltyPercentage, setRoyaltyPercentage] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mintedNFT, setMintedNFT] = useState<any | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null); // 保存图片的IPFS URI

  const options = {
    host: "ipfs.infura.io",
    port: 5001,
    protocol: "https",
    apiPath: "/api/v0",
  };

  const client = create(options); // 使用 Pinata 的 IPFS 客户端

  // 上传图片到Pinata
  const uploadImageToPinata = async (file: File) => {
    try {
      const added = await client.add(file);  // 将文件上传到IPFS
      const ipfsUri = `https://indigo-personal-landfowl-857.mypinata.cloud/ipfs/${added.path}`;  // 使用 Pinata 网关的URL
      setImageUri(ipfsUri);  // 保存图片的 URI
      return ipfsUri;
    } catch (error) {
      console.error("IPFS上传失败", error);
      notification.error("上传图片到IPFS失败，请重试！");
      return "";
    }
  };

  // 上传元数据到Pinata
  const uploadMetadataToPinata = async (metadata: any) => {
    try {
      const added = await client.add(JSON.stringify(metadata));  // 将元数据上传到IPFS
      const metadataUri = `https://indigo-personal-landfowl-857.mypinata.cloud/ipfs/${added.path}`;  // 使用 Pinata 网关的URL
      return metadataUri;
    } catch (error) {
      console.error("IPFS上传失败", error);
      notification.error("上传元数据到IPFS失败，请重试！");
      return "";
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleRoyaltyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 0 && value <= 1000) {
      setRoyaltyPercentage(value);
    } else {
      alert("版税比例必须在 0 到 1000 之间");
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const bigintValue = value ? BigInt(value) : 0n;
    setPrice(bigintValue);
  };

  // 铸造NFT的方法
  const handleMintItem = async () => {
    if (!imageUri || price === 0n || !royaltyPercentage) {
      alert("请填写完整的NFT信息");
      return;
    }

    setIsLoading(true);
    const notificationId = notification.loading("铸造中...");

    try {
      // 创建元数据
      const metadata = {
        name: "NFT Example", // 可以替换成你的NFT名称
        description: "这是一个示例NFT", // 描述
        image: imageUri, // 图片的IPFS URI
        price: price.toString(),
        royaltyPercentage,
        creator: connectedAddress, // 创建者地址
      };

      // 上传元数据到Pinata并获取URI
      const metadataUri = await uploadMetadataToPinata(metadata);
      if (!metadataUri) return;

      // 调用合约的铸造方法
      const tx = await writeContractAsync({
        functionName: "mintItem",
        args: [
          connectedAddress, // 收件人地址
          metadataUri,       // 上传到IPFS的元数据URI
          connectedAddress,  // 创建者地址
          BigInt(royaltyPercentage), // 版税百分比
        ],
      });

      // 等待交易确认，确保交易已成功
      notification.remove(notificationId);
      notification.success("NFT铸造成功！");

      // 更新mintedNFT状态，将新的NFT信息保存在状态中
      setMintedNFT({
        uri: metadataUri,
        price: price.toString(),
        royaltyPercentage,
      });

      setImageFile(null); // 重置图片
      setPrice(0n);       // 重置价格
      setRoyaltyPercentage(10); // 重置版税百分比
      setImageUri(null);  // 重置图片URI
    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
      notification.error("铸造失败，请重试！");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 p-8">
      <div className="max-w-xl w-full bg-white p-6 rounded-lg shadow-lg">
        <h1 className="text-3xl font-semibold text-center mb-6">铸造 NFT</h1>

        {!isConnected || isConnecting ? (
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* 上传图片输入框 */}
            <div className="mb-4">
              <label htmlFor="image" className="block text-xl font-medium mb-2">
                上传图片
              </label>
              <input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="input input-bordered w-full max-w-xs"
              />
            </div>

            {/* NFT价格输入框 */}
            <div className="mb-4">
              <label htmlFor="price" className="block text-xl font-medium mb-2">
                NFT价格 (单位: wei)
              </label>
              <input
                id="price"
                type="number"
                value={price.toString()} // 显示 bigint 类型的 price
                onChange={handlePriceChange}
                className="input input-bordered w-full max-w-xs"
                placeholder="输入NFT价格"
              />
            </div>

            {/* 版税百分比输入框 */}
            <div className="mb-4">
              <label htmlFor="royaltyPercentage" className="block text-xl font-medium mb-2">
                版税百分比 (0 - 1000)
              </label>
              <input
                id="royaltyPercentage"
                type="number"
                value={royaltyPercentage}
                onChange={handleRoyaltyChange}
                min="0"
                max="1000"
                className="input input-bordered w-full max-w-xs"
                placeholder="输入版税百分比"
              />
            </div>

            {/* 铸造按钮 */}
            <button
              onClick={handleMintItem}
              className="btn btn-primary w-full max-w-xs mt-4"
              disabled={isLoading}
            >
              {isLoading ? "铸造中..." : "铸造 NFT"}
            </button>

            {/* 显示铸造的NFT信息 */}
            {mintedNFT && (
              <div className="mt-6 p-4 bg-green-100 text-green-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold">铸造成功!</h2>
                <p><strong>URI:</strong> {mintedNFT.uri}</p>
                <p><strong>价格:</strong> {mintedNFT.price} wei</p>
                <p><strong>版税百分比:</strong> {mintedNFT.royaltyPercentage}%</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MintNFTPage;