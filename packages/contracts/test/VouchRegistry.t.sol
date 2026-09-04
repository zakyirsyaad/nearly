// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";
import {VouchRegistry} from "../src/VouchRegistry.sol";

contract VouchRegistryTest is Test {
    ConnectionRegistry conn;
    VouchRegistry reg;

    address attestor = address(0xA77E);
    uint256 pkA = 0xA11CE;
    uint256 pkB = 0xB0B;
    address alice;
    address bob;
    bytes32 constant TAGS = keccak256("real builder");
    uint64 expiresAt;

    function setUp() public {
        alice = vm.addr(pkA);
        bob = vm.addr(pkB);
        conn = new ConnectionRegistry(attestor);
        reg = new VouchRegistry(attestor, address(conn));
        expiresAt = uint64(block.timestamp + 1 hours);
        _connect();
    }

    function _connect() internal {
        bytes32 nonce = keccak256("n1");
        uint64 exp = uint64(block.timestamp + 1 hours);
        bytes memory sigOffer = _sign(pkA, _offerDigest(alice, nonce, exp));
        bytes memory sigAccept = _sign(pkB, _acceptDigest(alice, bob, nonce, exp));
        vm.prank(attestor);
        conn.connect(alice, bob, nonce, exp, sigOffer, sigAccept);
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _eip712(bytes32 separator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", separator, structHash));
    }

    function _offerDigest(address initiator, bytes32 nonce, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256("HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)"),
            initiator, nonce, exp
        ));
        return _eip712(conn.DOMAIN_SEPARATOR(), h);
    }

    function _acceptDigest(address initiator, address counterparty, bytes32 nonce, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256(
                "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)"
            ),
            initiator, counterparty, nonce, exp
        ));
        return _eip712(conn.DOMAIN_SEPARATOR(), h);
    }

    function _vouchDigest(address from, address to, bytes32 tagsHash, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256("Vouch(address from,address to,bytes32 tagsHash,uint64 expiresAt)"),
            from, to, tagsHash, exp
        ));
        return _eip712(reg.DOMAIN_SEPARATOR(), h);
    }

    function _revokeDigest(address from, address to, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256("RevokeVouch(address from,address to,uint64 expiresAt)"), from, to, exp
        ));
        return _eip712(reg.DOMAIN_SEPARATOR(), h);
    }

    function test_vouch_berhasil() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
        assertTrue(reg.isVouched(alice, bob));
    }

    function test_vouch_berarah_tidak_berlaku_sebaliknya() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
        assertFalse(reg.isVouched(bob, alice));
    }

    function test_vouch_tanpa_koneksi_gagal() public {
        address carol = vm.addr(0xC0);
        bytes memory sig = _sign(pkA, _vouchDigest(alice, carol, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.NotConnected.selector);
        vm.prank(attestor);
        reg.vouch(alice, carol, TAGS, expiresAt, sig);
    }

    function test_vouch_bukan_attestor_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.NotAttestor.selector);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_vouch_tanda_tangan_salah_gagal() public {
        bytes memory sig = _sign(pkB, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.BadSignature.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_vouch_kedaluwarsa_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(VouchRegistry.Expired.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_vouch_ke_diri_sendiri_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, alice, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.SelfVouch.selector);
        vm.prank(attestor);
        reg.vouch(alice, alice, TAGS, expiresAt, sig);
    }

    function test_vouch_dua_kali_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
        vm.expectRevert(VouchRegistry.AlreadyVouched.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_revoke_berhasil() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
        assertFalse(reg.isVouched(alice, bob));
    }

    function test_revoke_oleh_orang_lain_gagal() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkB, _revokeDigest(alice, bob, expiresAt));
        vm.expectRevert(VouchRegistry.BadSignature.selector);
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
    }

    function test_revoke_yang_belum_pernah_ada_gagal() public {
        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.expectRevert(VouchRegistry.NotVouched.selector);
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
    }

    function test_vouch_TIDAK_bisa_diputar_ulang_setelah_revoke() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);

        // Tanda tangan vouch yang SAMA dikirim ulang. Tanpa penjagaan ini,
        // attestor bisa menghidupkan kembali vouch yang sudah dicabut pengguna
        // tanpa persetujuan baru dari pengguna itu.
        vm.expectRevert(VouchRegistry.AlreadyVouched.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);
    }

    function test_revoke_TIDAK_bisa_diputar_ulang() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);

        vm.expectRevert(VouchRegistry.NotVouched.selector);
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
    }

    function test_tanda_tangan_high_s_ditolak() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        bytes32 r;
        bytes32 sVal;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            sVal := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        // Pasangan malleable: (r, n - s, v terbalik) memulihkan alamat yang sama
        // di ecrecover polos. Kontrak harus menolaknya.
        bytes32 sHigh = bytes32(
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - uint256(sVal)
        );
        bytes memory malleable = abi.encodePacked(r, sHigh, v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(VouchRegistry.BadSignature.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, malleable);
    }

    function test_slash_hanya_attestor() public {
        vm.expectRevert(VouchRegistry.NotAttestor.selector);
        reg.slash(bob);
    }

    function test_slash_menandai_subjek() public {
        vm.prank(attestor);
        reg.slash(bob);
        assertTrue(reg.slashed(bob));
    }

    function test_revoke_tidak_menghapus_slash() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);
        vm.prank(attestor);
        reg.slash(bob);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);

        // Mencabut vouch melepas tanggung jawab KE DEPAN, tapi slash yang sudah
        // terjadi tetap berdiri — kalau tidak, "skin in the game" jadi kosong.
        assertTrue(reg.slashed(bob));
    }
}
