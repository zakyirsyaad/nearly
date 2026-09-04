// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Graf koneksi Nearly.
 *
 * Aturan inti (spec §2): koneksi tidak bisa dibuat dari jarak jauh.
 * Kontrak menegakkan setengahnya — bahwa KEDUA pihak setuju, lewat dua tanda
 * tangan EIP-712. Setengah lainnya (bahwa keduanya benar-benar berada di tempat
 * yang sama) tidak bisa diverifikasi on-chain, jadi diverifikasi off-chain oleh
 * `attestor`. Karena itu `connect` hanya bisa dipanggil `attestor`.
 */
contract ConnectionRegistry {
    error NotAttestor();
    error SelfConnection();
    error Expired();
    error NonceUsed();
    error BadOfferSignature();
    error BadAcceptSignature();
    error AlreadyConnected();

    // WAJIB identik dengan HANDSHAKE_TYPES di packages/shared (dijaga Task 5).
    bytes32 private constant OFFER_TYPEHASH =
        keccak256("HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)");
    bytes32 private constant ACCEPT_TYPEHASH = keccak256(
        "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;
    address public immutable attestor;

    /// pairKey => waktu terkoneksi. 0 berarti belum terkoneksi.
    mapping(bytes32 => uint64) public connectedAt;
    mapping(bytes32 => bool) public nonceUsed;

    event Connected(address indexed a, address indexed b, uint64 at);

    constructor(address _attestor) {
        attestor = _attestor;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256("Nearly"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /// Kanonik: urutan argumen tidak mengubah hasil, jadi satu pasang = satu kunci.
    function pairKey(address x, address y) public pure returns (bytes32) {
        return x < y ? keccak256(abi.encode(x, y)) : keccak256(abi.encode(y, x));
    }

    function isConnected(address x, address y) external view returns (bool) {
        return connectedAt[pairKey(x, y)] != 0;
    }

    function connect(
        address initiator,
        address counterparty,
        bytes32 nonce,
        uint64 expiresAt,
        bytes calldata sigOffer,
        bytes calldata sigAccept
    ) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (initiator == counterparty) revert SelfConnection();
        if (block.timestamp > expiresAt) revert Expired();
        if (nonceUsed[nonce]) revert NonceUsed();

        bytes32 offerDigest =
            _digest(keccak256(abi.encode(OFFER_TYPEHASH, initiator, nonce, expiresAt)));
        if (_recover(offerDigest, sigOffer) != initiator) revert BadOfferSignature();

        bytes32 acceptDigest = _digest(
            keccak256(abi.encode(ACCEPT_TYPEHASH, initiator, counterparty, nonce, expiresAt))
        );
        if (_recover(acceptDigest, sigAccept) != counterparty) revert BadAcceptSignature();

        bytes32 key = pairKey(initiator, counterparty);
        if (connectedAt[key] != 0) revert AlreadyConnected();

        nonceUsed[nonce] = true;
        connectedAt[key] = uint64(block.timestamp);
        emit Connected(initiator, counterparty, uint64(block.timestamp));
    }

    function _digest(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        // Sebagian library menghasilkan v = 0/1, bukan 27/28.
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
