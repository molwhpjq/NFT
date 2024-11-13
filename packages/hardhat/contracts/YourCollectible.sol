// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2; 
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract YourCollectible is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    Ownable,
    ReentrancyGuard
{
    using Counters for Counters.Counter;

    Counters.Counter public tokenIdCounter;

    // 累计的上架费用
    uint256 public totalFeesCollected;

    struct NftItem {
        uint256 tokenId;
        uint256 price;
        address payable seller;
        bool isListed;
        string tokenUri;
        uint256 royaltyPercentage;  // 版税比例
        address payable royaltyRecipient;  // 版税接收者地址
    }

    // 交易记录结构体
struct TransactionRecord {
    address buyer;
    address seller; // 添加卖家的地址
    uint256 price; // 交易价格
    uint256 royaltyAmount; // 版税金额
    uint256 timestamp; // 交易时间
}

    // Token ID到NftItem的映射
    mapping(uint256 => NftItem) private _idToNftItem;
    // 确保每个tokenURI唯一
    mapping(string => bool) private _usedTokenURIs;

    // 维护所有上架的tokenId数组
    uint256[] private _listedTokenIds;
    // tokenId到_listedTokenIds数组索引的映射
    mapping(uint256 => uint256) private _tokenIdToListedIndex;

    // 上架费用比例（例如250代表2.5%）
    uint256 public listingFeePercentage = 250; // 2.5%
    uint256 public constant MAX_LISTING_FEE_PERCENTAGE = 1000; // 最多10%

    // 交易记录的映射，每个NFT对应一个交易记录数组
    mapping(uint256 => TransactionRecord[]) public nftTransactionHistory;

    // 事件
    event NftListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NftUnlisted(uint256 indexed tokenId, address indexed seller);
    event NftPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event ListingFeePercentageUpdated(uint256 newListingFeePercentage);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    event FeesReceived(address indexed sender, uint256 amount);
    event RoyaltyPaid(address indexed recipient, uint256 amount);

    constructor() ERC721("YourCollectible", "YCB") {}

    function _baseURI() internal pure override returns (string memory) {
        return "https://indigo-personal-landfowl-857.mypinata.cloud/ipfs/"; 
    }

    /**
     * @dev 铸造新的NFT
     * @param to 接收者地址
     * @param uri NFT的元数据URI
     * @param royaltyRecipient 版税接收者地址
     * @param royaltyPercentage 版税比例（例如100表示1%）
     * @return tokenId 新铸造的NFT的Token ID
     */
    function mintItem(address to, string memory uri, address payable royaltyRecipient, uint256 royaltyPercentage) public returns (uint256) {
        require(royaltyPercentage <= 1000, "Royalty percentage cannot exceed 10%");

        tokenIdCounter.increment();
        uint256 tokenId = tokenIdCounter.current();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // 拼接完整的 tokenURI
        string memory completeTokenURI = string(abi.encodePacked(_baseURI(), uri));

        _idToNftItem[tokenId] = NftItem({
            tokenId: tokenId,
            price: 0,
            seller: payable(address(0)),
            isListed: false,
            tokenUri: completeTokenURI,
            royaltyPercentage: royaltyPercentage,
            royaltyRecipient: royaltyRecipient
        });

        emit NftUnlisted(tokenId, address(0)); // 或其他适当的事件

        return tokenId;
    }

    /**
     * @dev 将NFT上架
     * @param tokenId 要上架的NFT的Token ID
     * @param price 上架的价格，单位为wei
     */
    function placeNftOnSale(uint256 tokenId, uint256 price) external payable nonReentrant {
        require(price > 0, "Price must be at least 1 wei");
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this NFT");
        require(!_idToNftItem[tokenId].isListed, "Item is already on sale");
        require(msg.value == calculateListingFee(price), "Incorrect listing fee");
        
        // 将NFT转移到合约中进行托管
        _transfer(msg.sender, address(this), tokenId);

        // 更新NftItem信息
        _idToNftItem[tokenId] = NftItem({
            tokenId: tokenId,
            price: price,
            seller: payable(msg.sender),
            isListed: true,
            tokenUri: tokenURI(tokenId),
            royaltyPercentage: _idToNftItem[tokenId].royaltyPercentage,
            royaltyRecipient: _idToNftItem[tokenId].royaltyRecipient
        });

        // 将tokenId添加到listedTokenIds数组，并记录其索引
        _listedTokenIds.push(tokenId);
        _tokenIdToListedIndex[tokenId] = _listedTokenIds.length - 1;

        totalFeesCollected += msg.value;

        emit NftListed(tokenId, msg.sender, price);
    }

    /**
  * @dev 购买NFT
 * @param tokenId 要购买的NFT的Token ID
 */
function purchaseNft(uint256 tokenId) external payable nonReentrant {
    NftItem storage item = _idToNftItem[tokenId];
    require(item.isListed, "Item is not listed for sale");
    require(msg.value >= item.price, "Payment must be exactly the price");
    require(item.seller != msg.sender, "You are the seller");

    // 取消上架并更新状态
    item.isListed = false;

    // 计算版税金额
    uint256 royaltyAmount = (msg.value * item.royaltyPercentage) / 10000;
    uint256 sellerAmount = msg.value - royaltyAmount;

    // 先转账给卖家，再更新seller地址
    address payable seller = item.seller; // 记录卖家的地址
    item.seller = payable(address(0)); // 重置卖家信息在转账之后
    item.price = 0;

    // 从listedTokenIds数组中移除tokenId
    _removeFromListed(tokenId);

    // 将ETH转给卖家和版税接收者
    (bool successSeller, ) = seller.call{value: sellerAmount}("");
    require(successSeller, "Transfer to seller failed");

    if (royaltyAmount > 0 && item.royaltyRecipient != address(0)) {
        (bool successRoyalty, ) = item.royaltyRecipient.call{value: royaltyAmount}("");
        require(successRoyalty, "Royalty transfer failed");
        emit RoyaltyPaid(item.royaltyRecipient, royaltyAmount);
    }

    // 将NFT转给买家
    this.transferFrom(address(this), msg.sender, tokenId);

    // 记录交易历史
    nftTransactionHistory[tokenId].push(TransactionRecord({
        buyer: msg.sender,
        seller: seller,
        price: msg.value,
        royaltyAmount: royaltyAmount,
        timestamp: block.timestamp
    }));

    emit NftPurchased(tokenId, msg.sender, item.price);
}

/**
 * @dev 获取NFT的交易历史
 * @param tokenId 要查询的NFT的Token ID
 * @return TransactionRecord[] 该NFT的所有交易记录
 */
function getTransactionHistory(uint256 tokenId) external view returns (TransactionRecord[] memory) {
    return nftTransactionHistory[tokenId];
}
    /**
     * @dev 获取NftItem信息
     * @param tokenId 要查询的NFT的Token ID
     * @return NftItem结构体
     */
    function getNftItem(uint256 tokenId) public view returns (NftItem memory) {
        return _idToNftItem[tokenId];
    }
    /**
     * @dev 设置新的上架费用比例（仅合约所有者可调用）
     * @param _newListingFeePercentage 新的上架费用比例（例如250代表2.5%）
     */
    function setListingFeePercentage(uint256 _newListingFeePercentage) external onlyOwner {
        require(_newListingFeePercentage <= MAX_LISTING_FEE_PERCENTAGE, "Listing fee cannot exceed 10%");
        listingFeePercentage = _newListingFeePercentage;
        emit ListingFeePercentageUpdated(_newListingFeePercentage);
    }

    /**
     * @dev 获取当前上架的NFT数量
     */
    function getListedItemsCount() external view returns (uint256) {
        return _listedTokenIds.length;
    }

    /**
     * @dev 从上架列表中移除tokenId
     * @param tokenId 要移除的tokenId
     */
    function _removeFromListed(uint256 tokenId) internal {
        uint256 index = _tokenIdToListedIndex[tokenId];
        uint256 lastTokenId = _listedTokenIds[_listedTokenIds.length - 1];

        // 将要移除的tokenId与最后一个tokenId交换
        _listedTokenIds[index] = lastTokenId;
        _tokenIdToListedIndex[lastTokenId] = index;

        // 删除最后一个元素
        _listedTokenIds.pop();

        // 删除映射中的条目
        delete _tokenIdToListedIndex[tokenId];
    }

    /**
     * @dev 获取所有上架的NFT
     * @return An array of NftItem structs
     */
    function getAllListedNfts() external view returns (NftItem[] memory) {
        uint256 totalListed = _listedTokenIds.length;
        NftItem[] memory items = new NftItem[](totalListed);
        for (uint256 i = 0; i < totalListed; i++) {
            uint256 tokenId = _listedTokenIds[i];
            items[i] = _idToNftItem[tokenId];
        }
        return items;
    }

    /**
     * @dev 计算上架费用
     * @param priceInWei NFT的售价，单位为wei
     * @return fee 上架费用，单位为wei
     */
    function calculateListingFee(uint256 priceInWei) public view returns (uint256) {
        uint256 fee = (priceInWei * listingFeePercentage) / 10000;
        return fee;
    }

    /**
     * @dev 提现累积的上架费用（仅合约所有者可调用）
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = totalFeesCollected;
        require(amount > 0, "No fees to withdraw");

        totalFeesCollected = 0;

        (bool success, ) = owner().call{value: amount}("");
        require(success, "Withdrawal failed");

        emit FeesWithdrawn(owner(), amount);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

}
