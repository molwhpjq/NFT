"use client";

import { useEffect, useState } from "react";
import { NFTCardOnSale } from "../myNFTs/_components/NFTCardOnSale";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
// import { OnSaleCollectible } from "~~/interfaces/OnSaleCollectible";
// import { utils } from "ethers";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
import { formatEther } from "viem"; 

export interface OnSaleCollectible extends Partial<NFTMetaData> {
  tokenId: string;
  price: string;
  seller: string;
  isListed: boolean;
  tokenURI: string;
}

export const Market = () => {
  const [onSaleCollectibles, setOnSaleCollectibles] = useState<OnSaleCollectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);

  // 获取合约实例
  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  // 调用合约函数获取所有上架的 NFT
  const { data: onSaleNfts} = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getAllListedNfts",
    watch: true,
  });

  const fetchListedNfts = async (): Promise<void> => {
       setAllCollectiblesLoading(true);
    try {
      const fetchedNfts: OnSaleCollectible[] = await Promise.all(
          (onSaleNfts || []).map(async (item: any) => {
          const tokenId: string = item.tokenId.toString();
          const priceInEth = formatEther(item.price);
          const price: string = priceInEth.toString();
          const seller: string = item.seller;
          const isListed: boolean = item.isListed;
          const tokenURI: string = item.tokenUri;

          // const tokenURI: string = await yourCollectibleContract.read.tokenURI([BigInt(item.tokenId)]);
        //  const tokenURI = "https://emerald-passive-snipe-259.mypinata.cloud/ipfs/QmTgqb16XcgQDR1CgY5ZrH4ynesZr4MG4JVNCFro4G5oCg";
          console.log("----------"+tokenURI);
          // 通过 tokenURI 获取元数据
          let metadata: Partial<NFTMetaData> = {};
          try {
            metadata = await getMetadataFromIPFS(tokenURI);
          } catch (err) {
            console.error(`Error fetching metadata for tokenId ${tokenId}:`, err);
            notification.error(`Error fetching metadata for tokenId ${tokenId}`);
          }

          return {
            tokenId,
            price,
            seller,
            isListed,
            tokenURI,
            ...metadata,
          };
        })
      );

      // 按 tokenId 排序（可选）
      // fetchedNfts.sort((a, b) => a.tokenId - b.tokenId);
      setOnSaleCollectibles(fetchedNfts);
    } catch (err) {
      console.error("Error fetching listed NFTs:", err);
      notification.error("Error fetching listed NFTs.");
    } finally {
      setAllCollectiblesLoading(false);
    }
  };


  useEffect(() => {
    if (!onSaleNfts || !yourCollectibleContract) return;
    fetchListedNfts();
  }, [onSaleNfts]);
  

  if (allCollectiblesLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <>
      {onSaleCollectibles.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">No NFTs found</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 my-8 px-5 justify-center">
          {onSaleCollectibles.map(nft => (
            <NFTCardOnSale nft={nft} key={nft.tokenId} />
          ))}
        </div>
      )}
    </>
  );
};

export default Market;