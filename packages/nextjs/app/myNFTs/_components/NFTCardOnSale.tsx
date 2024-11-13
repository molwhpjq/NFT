import { useState } from "react";
import { OnSaleCollectible } from "../../market/page";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { parseEther } from "viem";
import { notification } from "~~/utils/scaffold-eth";

export const NFTCardOnSale = ({ nft }: { nft: OnSaleCollectible }) => {
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  const [loading, setLoading] = useState(false);  // 用来处理交易过程中的loading状态

  const priceInWei = parseEther(nft.price.toString());  // 转换价格为wei

  // 购买NFT的处理函数
  const handlePurchase = async () => {
    setLoading(true);  // 开始加载
    try {
      await writeContractAsync({
        functionName: "purchaseNft",
        args: [BigInt(nft.tokenId.toString())],  // 获取tokenId
        value: priceInWei,  // 传递ETH价格
      });
      notification.success("购买成功！");  // 交易成功提示
    } catch (err) {
      console.error("Error calling purchaseNft:", err);
      notification.error("购买失败，请稍后再试。");  // 错误提示
    } finally {
      setLoading(false);  // 结束加载
    }
  };

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[300px] shadow-secondary">
      <figure className="relative">
        <img src={nft.image} alt="NFT Image" className="h-60 min-w-full" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
          <span className="text-white"># {nft.tokenId}</span>
        </figcaption>
      </figure>
      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <p className="text-xl p-0 m-0 font-semibold">{nft.name}</p>
          <div className="flex flex-wrap space-x-2 mt-1">
            {nft.attributes?.map((attr, index) => (
              <span key={index} className="badge badge-primary py-3">
                {attr.value}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center mt-1">
          <p className="my-0 text-lg">{nft.description}</p>
        </div>
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Owner: </span>
          <Address address={nft.seller as `0x${string}`} />
        </div>
        <div className="flex flex-col my-1 space-y-1">
          <span className="text-lg font-semibold">Price: {nft.price} ETH</span>
        </div>

        <div className="card-actions justify-end">
          <button
            className={`btn btn-secondary btn-md px-8 tracking-wide ${loading ? "loading" : ""}`}  // 添加loading样式
            onClick={handlePurchase}  // 触发购买逻辑
            disabled={loading}  // 交易进行时禁用按钮
          >
            {loading ? "Processing..." : "购买"}
          </button>
        </div>
      </div>
    </div>
  );
};