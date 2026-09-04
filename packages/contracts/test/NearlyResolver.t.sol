// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";
import {NearlyResolver} from "../src/NearlyResolver.sol";
import {TrustAttestor} from "../src/TrustAttestor.sol";
import {VouchRegistry} from "../src/VouchRegistry.sol";

contract NearlyResolverTest is Test {
    ConnectionRegistry conn;
    VouchRegistry vouch;
    TrustAttestor att;
    NearlyResolver resolver;

    address attestor = address(0xA77E);
    uint256 pkA = 0xA11CE;
    uint256 pkB = 0xB0B;
    address alice;
    address bob;

    function setUp() public {
        alice = vm.addr(pkA);
        bob = vm.addr(pkB);
        conn = new ConnectionRegistry(attestor);
        vouch = new VouchRegistry(attestor, address(conn));
        att = new TrustAttestor(attestor);
        resolver = new NearlyResolver(address(conn), address(vouch), address(att));
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _eip712(bytes32 separator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", separator, structHash));
    }

    function _connect() internal {
        bytes32 nonce = keccak256("n1");
        uint64 exp = uint64(block.timestamp + 1 hours);

        bytes32 ho = keccak256(abi.encode(
            keccak256("HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)"),
            alice, nonce, exp
        ));
        bytes32 ha = keccak256(abi.encode(
            keccak256(
                "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)"
            ),
            alice, bob, nonce, exp
        ));
        bytes memory sigOffer = _sign(pkA, _eip712(conn.DOMAIN_SEPARATOR(), ho));
        bytes memory sigAccept = _sign(pkB, _eip712(conn.DOMAIN_SEPARATOR(), ha));
        vm.prank(attestor);
        conn.connect(alice, bob, nonce, exp, sigOffer, sigAccept);
    }

    function test_getTrust_dan_getTier_membaca_dari_attestor() public {
        vm.prank(attestor);
        att.setScore(alice, 450_000, 3);
        assertEq(resolver.getTrust(alice), 450_000);
        assertEq(resolver.getTier(alice), 3);
    }

    function test_getUpdatedAt_membaca_dari_attestor() public {
        vm.warp(block.timestamp + 1000);
        vm.prank(attestor);
        att.setScore(alice, 450_000, 3);
        assertEq(resolver.getUpdatedAt(alice), uint64(block.timestamp));
    }

    function test_getUpdatedAt_alamat_yang_belum_pernah_ditulis_bernilai_nol() public view {
        assertEq(resolver.getUpdatedAt(address(0xDEAD)), 0);
    }

    function test_alamat_asing_bernilai_nol_dan_tier_Baru() public view {
        assertEq(resolver.getTrust(address(0xDEAD)), 0);
        assertEq(resolver.getTier(address(0xDEAD)), 0);
    }

    function test_isConnected_membaca_dari_ConnectionRegistry() public {
        assertFalse(resolver.isConnected(alice, bob));
        _connect();
        assertTrue(resolver.isConnected(alice, bob));
    }

    function test_isConnected_tidak_peduli_urutan_argumen() public {
        _connect();
        assertTrue(resolver.isConnected(bob, alice));
    }

    function test_isSlashed_membaca_dari_VouchRegistry() public {
        assertFalse(resolver.isSlashed(bob));
        vm.prank(attestor);
        vouch.slash(bob);
        assertTrue(resolver.isSlashed(bob));
    }

    function test_konstruktor_menolak_alamat_nol() public {
        vm.expectRevert(NearlyResolver.ZeroAddress.selector);
        new NearlyResolver(address(0), address(vouch), address(att));
        vm.expectRevert(NearlyResolver.ZeroAddress.selector);
        new NearlyResolver(address(conn), address(0), address(att));
        vm.expectRevert(NearlyResolver.ZeroAddress.selector);
        new NearlyResolver(address(conn), address(vouch), address(0));
    }

    function test_resolver_bukan_attestor_di_kontrak_mana_pun() public view {
        // Resolver hanya baca. Kalau suatu saat seseorang menambahkan fungsi
        // tulis di sini, panggilannya tetap gagal karena alamat ini bukan
        // attestor di registry mana pun.
        assertTrue(address(resolver) != conn.attestor());
        assertTrue(address(resolver) != vouch.attestor());
        assertTrue(address(resolver) != att.attestor());
    }
}
