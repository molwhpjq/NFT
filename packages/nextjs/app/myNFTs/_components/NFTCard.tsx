import { useState, useEffect } from "react";
import { Collectible } from "./MyHoldings";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useScaffoldReadContract, useScaffoldContract } from "~~/hooks/scaffold-eth";
import { parseEther } from "viem";
import Modal from "react-modal";

export const NFTCard = ({ nft }: { nft: Collectible }) => {
  const [transferToAddress, setTransferToAddress] = useState("");
  const [isListed, setIsListed] = useState(false);
  const [price, setPrice] = useState<string>(""); // 以ETH为单位
  const [isDetailsVisible, setIsDetailsVisible] = useState(false); // 控制NFT详细信息的显示
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]); // 存储交易历史

  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  const { data: nftItem } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getNftItem",
    args: [BigInt(nft.id.toString())],
    watch: true,
  });

  // 获取交易历史
  useEffect(() => {
    if (nftItem) {
      setIsListed(nftItem.isListed as boolean);
      setPrice(BigInt(nftItem.price).toString());
    } else {
      setIsListed(false);
      setPrice("");
    }
  }, [nftItem]);

  const handleListNFT = async () => {
    console.log("上架 NFT:", nft.id);
    console.log("价格:", price);
    const priceWei = parseEther(price); // 将 ETH 转换为 wei
    console.log("价格 (wei):", priceWei);

    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert("请输入有效的价格（ETH）");
      return;
    }

    const listingPrice = await yourCollectibleContract?.read.calculateListingFee([BigInt(priceWei)]);
    console.log("上架费用 (wei):", listingPrice);

    try {
      await writeContractAsync({
        functionName: "placeNftOnSale",
        args: [BigInt(nft.id.toString()), priceWei],
        value: listingPrice,
      });
    } catch (err) {
      console.error("Error calling placeNftOnSale function");
    }
  };

  const handleUnlistNFT = async () => {
    console.log("下架 NFT:", nft.id);
    try {
      await writeContractAsync({
        functionName: "unlistNft",
        args: [BigInt(nft.id.toString())],
      });
    } catch (err) {
      console.error("Error calling unlistNft function");
    }
  };

  // 获取交易历史记录
  const handleShowDetails = async () => {
    try {
      const history = await yourCollectibleContract?.read.getTransactionHistory([BigInt(nft.id.toString())]);
      setTransactionHistory([...(history || [])]);
      setIsDetailsVisible(true); // 打开弹框
    } catch (err) {
      console.error("Error fetching transaction history", err);
    }
  };

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[300px] shadow-secondary">
      <figure className="relative">
        {/* eslint-disable-next-line */}
        <img
          src={nft.image}
          alt="NFT Image"
          className="h-60 min-w-full cursor-pointer rounded-xl transition-all duration-300 hover:scale-105"
          onClick={handleShowDetails} // 点击图片时展示NFT详细信息
        />
        <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
          <span className="text-white "># {nft.id}</span>
        </figcaption>
      </figure>

      {/* NFT卡片内容 */}
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
          <span className="text-lg font-semibold">Owner : </span>
          <Address address={nft.owner as `0x${string}`} />
        </div>

        {/* Transfer 地址输入框 */}
        <div className="flex flex-col my-2 space-y-1">
          <span className="text-lg font-semibold mb-1">Transfer To: </span>
          <AddressInput
            value={transferToAddress}
            placeholder="receiver address"
            onChange={newValue => setTransferToAddress(newValue)}
          />
        </div>

        {/* NFT交易按钮 */}
        <div className="card-actions justify-end">
          <button
            className="btn btn-secondary btn-md px-8 tracking-wide"
            onClick={() => {
              try {
                writeContractAsync({
                  functionName: "transferFrom",
                  args: [nft.owner as `0x${string}`, transferToAddress as `0x${string}`, BigInt(nft.id.toString())],
                });
              } catch (err) {
                console.error("Error calling transferFrom function");
              }
            }}
          >
            Send
          </button>

          {/* 上架和下架按钮 */}
          {!isListed && (
            <div className="flex items-center my-2 space-x-3">
              <span className="text-lg font-semibold">Price(ETH)</span>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input input-xs rounded-lg shadow-sm w-20 px-1 py-0.5"
                placeholder="Enter price"
              />
              <button
                className="btn btn-primary btn-sm px-4 py-1"
                onClick={handleListNFT}
              >
                上架
              </button>
            </div>
          )}

          {isListed && (
            <div className="flex items-center my-2 space-x-3">
              <span className="text-lg font-semibold">Price(ETH):{price}</span>
              <button
                className="btn btn-primary btn-sm px-4 py-1"
                onClick={handleUnlistNFT}
              >
                下架
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 弹框显示NFT交易历史记录 */}
      <Modal
  isOpen={isDetailsVisible}
  onRequestClose={() => setIsDetailsVisible(false)}
  contentLabel="NFT Details"
  className="modal modal-open p-4 max-w-[400px] mx-auto bg-white rounded-xl shadow-lg"
  overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
>
  <h3 className="text-2xl font-semibold mb-4">Transaction History</h3>
  <ul className="space-y-2">
    {transactionHistory.map((record, index) => (
      <li key={index} className="border-b py-2">
        <div><strong>Buyer:</strong> <Address address={record.buyer as `0x${string}`} /></div>
        <div><strong>Seller:</strong> <Address address={record.seller as `0x${string}`} /></div>
        <div><strong>Price:</strong> {record.price} wei</div>
        <div><strong>Royalty Amount:</strong> {record.royaltyAmount} wei</div>
        <div><strong>Timestamp:</strong> {new Date(Number(record.timestamp) * 1000).toLocaleString()}</div>
      </li>
    ))}
  </ul>
  <button
    className="btn btn-secondary mt-4"
    onClick={() => setIsDetailsVisible(false)}
  >
    Close
  </button>
</Modal>
    </div>
  );
};