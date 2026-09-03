// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";

contract ConnectionRegistryTest is Test {
    // String tipe ini WAJIB identik dengan HANDSHAKE_TYPES di packages/shared.
    // Dijaga oleh Task 5.
    string constant OFFER_TYPE = "HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)";
    string constant ACCEPT_TYPE =
        "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)";

    ConnectionRegistry reg;
    address attestor = address(0xA77E5709);
    uint256 pkA = 0xA11CE;
    uint256 pkB = 0xB0B;
    address a;
    address b;
    bytes32 nonce = keccak256("nonce-1");
    uint64 expiresAt;

    function setUp() public {
        vm.warp(1_700_000_000);
        reg = new ConnectionRegistry(attestor);
        a = vm.addr(pkA);
        b = vm.addr(pkB);
        expiresAt = uint64(block.timestamp + 30);
    }

    function _digest(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", reg.DOMAIN_SEPARATOR(), structHash));
    }

    function _sigOffer(uint256 pk, address initiator, bytes32 n, uint64 exp)
        internal view returns (bytes memory)
    {
        bytes32 sh = keccak256(abi.encode(keccak256(bytes(OFFER_TYPE)), initiator, n, exp));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, _digest(sh));
        return abi.encodePacked(r, s, v);
    }

    function _sigAccept(uint256 pk, address initiator, address counterparty, bytes32 n, uint64 exp)
        internal view returns (bytes memory)
    {
        bytes32 sh =
            keccak256(abi.encode(keccak256(bytes(ACCEPT_TYPE)), initiator, counterparty, n, exp));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, _digest(sh));
        return abi.encodePacked(r, s, v);
    }

    /**
     * CATATAN PENTING soal cheatcode Foundry:
     * `vm.prank` hanya berlaku untuk SATU panggilan berikutnya, dan `vm.sign`
     * sendiri adalah panggilan cheatcode. Kalau helper tanda tangan dipanggil
     * sebagai ARGUMEN `reg.connect(...)`, `vm.sign` di dalamnya akan menelan
     * prank tersebut dan `connect` berjalan sebagai sender yang salah.
     *
     * Karena itu setiap test di bawah menghitung tanda tangan ke variabel lokal
     * lebih dulu, lalu memasang expectRevert, lalu prank, baru memanggil.
     */
    function _connect() internal {
        bytes memory so = _sigOffer(pkA, a, nonce, expiresAt);
        bytes memory sa = _sigAccept(pkB, a, b, nonce, expiresAt);
        vm.prank(attestor);
        reg.connect(a, b, nonce, expiresAt, so, sa);
    }

    function test_koneksiBerhasilDenganDuaTandaTangan() public {
        _connect();
        assertTrue(reg.isConnected(a, b));
    }

    function test_isConnectedSimetris() public {
        _connect();
        assertTrue(reg.isConnected(b, a));
    }

    function test_pairKeyKanonik() public view {
        assertEq(reg.pairKey(a, b), reg.pairKey(b, a));
    }

    function test_emitConnected() public {
        bytes memory so = _sigOffer(pkA, a, nonce, expiresAt);
        bytes memory sa = _sigAccept(pkB, a, b, nonce, expiresAt);
        vm.expectEmit(true, true, false, true);
        emit ConnectionRegistry.Connected(a, b, uint64(block.timestamp));
        vm.prank(attestor);
        reg.connect(a, b, nonce, expiresAt, so, sa);
    }

    function test_gagalKalauBukanAttestor() public {
        bytes memory so = _sigOffer(pkA, a, nonce, expiresAt);
        bytes memory sa = _sigAccept(pkB, a, b, nonce, expiresAt);
        vm.expectRevert(ConnectionRegistry.NotAttestor.selector);
        reg.connect(a, b, nonce, expiresAt, so, sa);
    }

    function test_gagalKalauTandaTanganOfferBukanDariInitiator() public {
        bytes memory so = _sigOffer(pkB, a, nonce, expiresAt); // B menandatangani offer milik A
        bytes memory sa = _sigAccept(pkB, a, b, nonce, expiresAt);
        vm.expectRevert(ConnectionRegistry.BadOfferSignature.selector);
        vm.prank(attestor);
        reg.connect(a, b, nonce, expiresAt, so, sa);
    }

    function test_gagalKalauTandaTanganAcceptBukanDariCounterparty() public {
        bytes memory so = _sigOffer(pkA, a, nonce, expiresAt);
        bytes memory sa = _sigAccept(pkA, a, b, nonce, expiresAt); // A menandatangani accept milik B
        vm.expectRevert(ConnectionRegistry.BadAcceptSignature.selector);
        vm.prank(attestor);
        reg.connect(a, b, nonce, expiresAt, so, sa);
    }

    function test_gagalKalauKedaluwarsa() public {
        bytes memory so = _sigOffer(pkA, a, nonce, expiresAt);
        bytes memory sa = _sigAccept(pkB, a, b, nonce, expiresAt);
        vm.warp(uint256(expiresAt) + 1);
        vm.expectRevert(ConnectionRegistry.Expired.selector);
        vm.prank(attestor);
        reg.connect(a, b, nonce, expiresAt, so, sa);
    }

    function test_gagalKalauNonceDipakaiUlang() public {
        _connect();
        bytes memory so = _sigOffer(pkA, a, nonce, expiresAt);
        bytes memory sa = _sigAccept(pkB, a, b, nonce, expiresAt);
        vm.expectRevert(ConnectionRegistry.NonceUsed.selector);
        vm.prank(attestor);
        reg.connect(a, b, nonce, expiresAt, so, sa);
    }

    function test_gagalKalauSudahTerkoneksiDenganNonceBaru() public {
        _connect();
        bytes32 n2 = keccak256("nonce-2");
        bytes memory so = _sigOffer(pkA, a, n2, expiresAt);
        bytes memory sa = _sigAccept(pkB, a, b, n2, expiresAt);
        vm.expectRevert(ConnectionRegistry.AlreadyConnected.selector);
        vm.prank(attestor);
        reg.connect(a, b, n2, expiresAt, so, sa);
    }

    function test_gagalKalauKoneksiKeDiriSendiri() public {
        bytes memory so = _sigOffer(pkA, a, nonce, expiresAt);
        bytes memory sa = _sigAccept(pkA, a, a, nonce, expiresAt);
        vm.expectRevert(ConnectionRegistry.SelfConnection.selector);
        vm.prank(attestor);
        reg.connect(a, a, nonce, expiresAt, so, sa);
    }

    function test_gagalKalauPanjangTandaTanganSalah() public {
        bytes memory sa = _sigAccept(pkB, a, b, nonce, expiresAt);
        vm.expectRevert(ConnectionRegistry.BadOfferSignature.selector);
        vm.prank(attestor);
        reg.connect(a, b, nonce, expiresAt, hex"1234", sa);
    }

    function test_belumTerkoneksiSebelumApaPun() public view {
        assertFalse(reg.isConnected(a, b));
        assertEq(reg.connectedAt(reg.pairKey(a, b)), 0);
    }
}
