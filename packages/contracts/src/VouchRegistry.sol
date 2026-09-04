// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IConnectionRegistry {
    function isConnected(address x, address y) external view returns (bool);
}

/**
 * Vouch, revoke, dan slash.
 *
 * Vouch adalah taruhan reputasi: kamu menjamin seseorang, dan kalau dia
 * terbukti menipu, skormu ikut turun (spec induk §7.3). Karena itu kontrak
 * menegakkan satu hal yang tidak boleh bisa dilewati server: VOUCH TANPA
 * KONEKSI FISIK MUSTAHIL.
 *
 * Kunci map BERARAH, tidak seperti ConnectionRegistry yang kanonik —
 * A menjamin B bukan hal yang sama dengan B menjamin A.
 */
contract VouchRegistry {
    error NotAttestor();
    error NotConnected();
    error SelfVouch();
    error Expired();
    error BadSignature();
    error AlreadyVouched();
    error NotVouched();

    // WAJIB identik dengan VOUCH_TYPES di packages/shared/src/vouch.ts (dijaga Task 9).
    bytes32 private constant VOUCH_TYPEHASH =
        keccak256("Vouch(address from,address to,bytes32 tagsHash,uint64 expiresAt)");
    bytes32 private constant REVOKE_TYPEHASH =
        keccak256("RevokeVouch(address from,address to,uint64 expiresAt)");
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;
    address public immutable attestor;
    IConnectionRegistry public immutable connections;

    struct VouchRecord {
        bytes32 tagsHash;
        uint64 at;
    }

    /// keccak(from, to) => vouch. BERARAH.
    mapping(bytes32 => VouchRecord) public vouches;
    mapping(address => bool) public slashed;

    event Vouched(address indexed from, address indexed to, bytes32 tagsHash, uint64 at);
    event Revoked(address indexed from, address indexed to, uint64 at);
    event Slashed(address indexed subject, uint64 at);

    constructor(address _attestor, address _connections) {
        attestor = _attestor;
        connections = IConnectionRegistry(_connections);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256("Nearly"), keccak256("1"), block.chainid, address(this)
            )
        );
    }

    function vouchKey(address from, address to) public pure returns (bytes32) {
        return keccak256(abi.encode(from, to));
    }

    function isVouched(address from, address to) external view returns (bool) {
        return vouches[vouchKey(from, to)].at != 0;
    }

    function vouch(
        address from,
        address to,
        bytes32 tagsHash,
        uint64 expiresAt,
        bytes calldata sig
    ) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (from == to) revert SelfVouch();
        if (block.timestamp > expiresAt) revert Expired();
        if (!connections.isConnected(from, to)) revert NotConnected();

        bytes32 digest =
            _digest(keccak256(abi.encode(VOUCH_TYPEHASH, from, to, tagsHash, expiresAt)));
        if (_recover(digest, sig) != from) revert BadSignature();

        bytes32 key = vouchKey(from, to);
        if (vouches[key].at != 0) revert AlreadyVouched();

        vouches[key] = VouchRecord({tagsHash: tagsHash, at: uint64(block.timestamp)});
        emit Vouched(from, to, tagsHash, uint64(block.timestamp));
    }

    function revoke(address from, address to, uint64 expiresAt, bytes calldata sig) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (block.timestamp > expiresAt) revert Expired();

        bytes32 digest = _digest(keccak256(abi.encode(REVOKE_TYPEHASH, from, to, expiresAt)));
        if (_recover(digest, sig) != from) revert BadSignature();

        bytes32 key = vouchKey(from, to);
        if (vouches[key].at == 0) revert NotVouched();

        delete vouches[key];
        emit Revoked(from, to, uint64(block.timestamp));
    }

    /**
     * Hasil peninjauan manusia atas laporan yang lolos gerbang (spec fase §6).
     * Gerbangnya sendiri hidup off-chain di packages/trust/src/slashing.ts —
     * isi laporan berisi tuduhan terhadap orang dan tidak boleh naik on-chain.
     */
    function slash(address subject) external {
        if (msg.sender != attestor) revert NotAttestor();
        slashed[subject] = true;
        emit Slashed(subject, uint64(block.timestamp));
    }

    function _digest(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", DOMAIN_SEPARATOR, structHash));
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
