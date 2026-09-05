// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttendanceRegistry} from "../src/AttendanceRegistry.sol";

contract AttendanceRegistryTest is Test {
    AttendanceRegistry reg;

    address attestor = address(0xA77E);
    uint256 pkHost = 0x8057;
    uint256 pkGuest = 0x6DE57;
    address host;
    address guest;

    bytes32 constant EVENT_ID = keccak256("event-1");
    bytes32 constant NONCE = keccak256("nonce-1");
    // Literal string rata-kiri, cocok dengan pad(dir:"right") di cellToBytes32.
    // bytes32(bytes("...")) TIDAK sah: bytes dinamis tidak bisa dikonversi ke bytes32.
    bytes32 constant CELL = "qqguv1r";

    uint64 startsAt;
    uint64 endsAt;
    uint64 expiresAt;

    function setUp() public {
        host = vm.addr(pkHost);
        guest = vm.addr(pkGuest);
        reg = new AttendanceRegistry(attestor);

        startsAt = uint64(block.timestamp);
        endsAt = uint64(block.timestamp + 3 hours);
        expiresAt = uint64(block.timestamp + 1 hours);
        _createEvent();
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _eip712(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", reg.DOMAIN_SEPARATOR(), structHash));
    }

    function _createDigest() internal view returns (bytes32) {
        return _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            EVENT_ID, host, startsAt, endsAt, CELL, expiresAt
        )));
    }

    function _offerDigest(bytes32 nonce) internal view returns (bytes32) {
        return _eip712(keccak256(abi.encode(
            keccak256("CheckInOffer(bytes32 eventId,bytes32 nonce,uint64 expiresAt)"),
            EVENT_ID, nonce, expiresAt
        )));
    }

    function _acceptDigest(bytes32 nonce, address attendee) internal view returns (bytes32) {
        return _eip712(keccak256(abi.encode(
            keccak256("CheckInAccept(bytes32 eventId,bytes32 nonce,address attendee,uint64 expiresAt)"),
            EVENT_ID, nonce, attendee, expiresAt
        )));
    }

    function _createEvent() internal {
        // Tanda tangan WAJIB dihitung sebelum vm.prank: _createDigest()
        // memanggil reg.DOMAIN_SEPARATOR() (staticcall ke `reg`), dan
        // vm.prank hanya berlaku untuk PANGGILAN BERIKUTNYA ke `reg` —
        // staticcall itu sendiri yang akan memakainya kalau dipanggil inline
        // setelah prank, sehingga createEvent() jatuh tanpa penyamaran.
        bytes memory sig = _sign(pkHost, _createDigest());
        vm.prank(attestor);
        reg.createEvent(EVENT_ID, host, startsAt, endsAt, CELL, expiresAt, sig);
    }

    function _checkIn(bytes32 nonce) internal {
        bytes memory sigHost = _sign(pkHost, _offerDigest(nonce));
        bytes memory sigGuest = _sign(pkGuest, _acceptDigest(nonce, guest));
        vm.prank(attestor);
        reg.checkIn(EVENT_ID, guest, nonce, expiresAt, sigHost, sigGuest);
    }

    function test_eventTercatat() public view {
        (address h, uint64 s, uint64 e, bytes32 c) = reg.events(EVENT_ID);
        assertEq(h, host);
        assertEq(s, startsAt);
        assertEq(e, endsAt);
        assertEq(c, CELL);
    }

    function test_checkInMencatatWaktu() public {
        _checkIn(NONCE);
        assertEq(reg.attendedAt(EVENT_ID, guest), uint64(block.timestamp));
    }

    function test_bukanAttestorDitolak() public {
        vm.expectRevert(AttendanceRegistry.NotAttestor.selector);
        reg.checkIn(EVENT_ID, guest, NONCE, expiresAt, hex"00", hex"00");
    }

    function test_eventGandaDitolak() public {
        bytes memory sig = _sign(pkHost, _createDigest());
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.EventExists.selector);
        reg.createEvent(EVENT_ID, host, startsAt, endsAt, CELL, expiresAt, sig);
    }

    function test_jendelaTerbalikDitolak() public {
        bytes32 id = keccak256("event-2");
        bytes32 digest = _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            id, host, endsAt, startsAt, CELL, expiresAt
        )));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadWindow.selector);
        reg.createEvent(id, host, endsAt, startsAt, CELL, expiresAt, _sign(pkHost, digest));
    }

    // Sebelum ini, penjagaan attestor pada createEvent tidak diuji sama
    // sekali — bisa dihapus dan 15 test lama tetap hijau. Tidak ada
    // vm.prank, jadi msg.sender adalah kontrak test sendiri, bukan attestor.
    function test_buatEventBukanAttestorDitolak() public {
        vm.expectRevert(AttendanceRegistry.NotAttestor.selector);
        reg.createEvent(
            keccak256("event-bukan-attestor"), host, startsAt, endsAt, CELL, expiresAt, hex"00"
        );
    }

    // Ini SATU-SATUNYA test yang menegakkan otorisasi host pada createEvent:
    // digest ditandatangani pkGuest, bukan pkHost, jadi _recover mengembalikan
    // alamat tamu, bukan host, dan createEvent wajib menolaknya.
    function test_buatEventTandaTanganPalsuDitolak() public {
        bytes32 id = keccak256("event-tandatangan-palsu");
        bytes32 digest = _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            id, host, startsAt, endsAt, CELL, expiresAt
        )));
        // Tanda tangan dihitung sebelum vm.prank — lihat catatan di _createEvent().
        bytes memory sig = _sign(pkGuest, digest);
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.createEvent(id, host, startsAt, endsAt, CELL, expiresAt, sig);
    }

    function test_buatEventKedaluwarsaDitolak() public {
        bytes32 id = keccak256("event-kedaluwarsa");
        bytes32 digest = _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            id, host, startsAt, endsAt, CELL, expiresAt
        )));
        // Tanda tangan dihitung sebelum warp dan prank, sama seperti pola lain.
        bytes memory sig = _sign(pkHost, digest);
        vm.warp(expiresAt + 1);
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.Expired.selector);
        reg.createEvent(id, host, startsAt, endsAt, CELL, expiresAt, sig);
    }

    function test_checkInKeEventTakDikenalDitolak() public {
        bytes memory sigHost = _sign(pkHost, _offerDigest(NONCE));
        bytes memory sigGuest = _sign(pkGuest, _acceptDigest(NONCE, guest));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.EventUnknown.selector);
        reg.checkIn(keccak256("hantu"), guest, NONCE, expiresAt, sigHost, sigGuest);
    }

    function test_sebelumMulaiDitolak() public {
        // Event kedua yang baru mulai satu jam lagi.
        bytes32 id = keccak256("event-nanti");
        uint64 s = uint64(block.timestamp + 1 hours);
        uint64 e = uint64(block.timestamp + 2 hours);
        bytes32 createDigest = _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            id, host, s, e, CELL, expiresAt
        )));
        vm.prank(attestor);
        reg.createEvent(id, host, s, e, CELL, expiresAt, _sign(pkHost, createDigest));

        bytes32 offerDigest = _eip712(keccak256(abi.encode(
            keccak256("CheckInOffer(bytes32 eventId,bytes32 nonce,uint64 expiresAt)"),
            id, NONCE, expiresAt
        )));
        bytes32 acceptDigest = _eip712(keccak256(abi.encode(
            keccak256("CheckInAccept(bytes32 eventId,bytes32 nonce,address attendee,uint64 expiresAt)"),
            id, NONCE, guest, expiresAt
        )));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.NotLive.selector);
        reg.checkIn(
            id, guest, NONCE, expiresAt,
            _sign(pkHost, offerDigest), _sign(pkGuest, acceptDigest)
        );
    }

    function test_setelahSelesaiDitolak() public {
        vm.warp(endsAt + 1);
        bytes memory sigHost = _sign(pkHost, _offerDigest(NONCE));
        bytes memory sigGuest = _sign(pkGuest, _acceptDigest(NONCE, guest));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.NotLive.selector);
        reg.checkIn(EVENT_ID, guest, NONCE, expiresAt, sigHost, sigGuest);
    }

    function test_tandaTanganHostPalsuDitolak() public {
        bytes memory sigHost = _sign(pkGuest, _offerDigest(NONCE)); // ditandatangani tamu, bukan host
        bytes memory sigGuest = _sign(pkGuest, _acceptDigest(NONCE, guest));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.checkIn(EVENT_ID, guest, NONCE, expiresAt, sigHost, sigGuest);
    }

    function test_tandaTanganTamuPalsuDitolak() public {
        bytes memory sigHost = _sign(pkHost, _offerDigest(NONCE));
        bytes memory sigGuest = _sign(pkHost, _acceptDigest(NONCE, guest)); // ditandatangani host, bukan tamu
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.checkIn(EVENT_ID, guest, NONCE, expiresAt, sigHost, sigGuest);
    }

    function test_nonceDipakaiUlangDitolak() public {
        _checkIn(NONCE);
        address other = vm.addr(0xFEED);
        bytes memory sigOther = _sign(0xFEED, _acceptDigest(NONCE, other));
        bytes memory sigHost = _sign(pkHost, _offerDigest(NONCE));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.NonceUsed.selector);
        reg.checkIn(EVENT_ID, other, NONCE, expiresAt, sigHost, sigOther);
    }

    function test_checkInKeduaDitolak() public {
        _checkIn(NONCE);
        bytes32 nonce2 = keccak256("nonce-2");
        bytes memory sigHost = _sign(pkHost, _offerDigest(nonce2));
        bytes memory sigGuest = _sign(pkGuest, _acceptDigest(nonce2, guest));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.AlreadyCheckedIn.selector);
        reg.checkIn(EVENT_ID, guest, nonce2, expiresAt, sigHost, sigGuest);
    }

    function test_kedaluwarsaDitolak() public {
        vm.warp(expiresAt + 1);
        bytes memory sigHost = _sign(pkHost, _offerDigest(NONCE));
        bytes memory sigGuest = _sign(pkGuest, _acceptDigest(NONCE, guest));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.Expired.selector);
        reg.checkIn(EVENT_ID, guest, NONCE, expiresAt, sigHost, sigGuest);
    }

    // Tiap tanda tangan sah punya pasangan malleable yang memulihkan alamat
    // sama. Kalau tidak ditolak, satu persetujuan punya dua bentuk byte — dan
    // penjagaan nonce bisa dilewati dengan bentuk yang kedua.
    function test_tandaTanganMalleableDitolak() public {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pkGuest, _acceptDigest(NONCE, guest));
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 sFlipped = bytes32(n - uint256(s));
        uint8 vFlipped = v == 27 ? 28 : 27;
        bytes memory sigHost = _sign(pkHost, _offerDigest(NONCE));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.checkIn(
            EVENT_ID, guest, NONCE, expiresAt, sigHost, abi.encodePacked(r, sFlipped, vFlipped)
        );
    }

    function test_attestorNolDitolak() public {
        vm.expectRevert(AttendanceRegistry.ZeroAddress.selector);
        new AttendanceRegistry(address(0));
    }

    // Tanpa guard `attendee == address(0)`, tanda tangan tamu yang rusak
    // (panjang bukan 65 byte) membuat _recover mengembalikan address(0) —
    // dan kalau attendee juga address(0), pencocokan itu LOLOS, bukan
    // ditolak, sehingga kehadiran palsu untuk address(0) tercatat. sigHost
    // sengaja dibuat SAH supaya jalur ini benar-benar tercapai kalau guard
    // dicabut; guard attendee == address(0) yang wajib menangkapnya lebih
    // dulu, sebelum tanda tangan sempat diperiksa.
    function test_checkInAlamatNolDenganTandaTanganRusakDitolak() public {
        bytes memory sigHost = _sign(pkHost, _offerDigest(NONCE));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.checkIn(EVENT_ID, address(0), NONCE, expiresAt, sigHost, hex"00");
    }

    // Tanpa guard `host == address(0)`, tanda tangan yang rusak (panjang
    // bukan 65 byte) membuat _recover mengembalikan address(0) — dan kalau
    // host yang dikirim juga address(0), pencocokan `_recover(...) != host`
    // jadi `address(0) != address(0)` yang FALSE, sehingga pemeriksaan
    // tanda tangan LOLOS dan event tercatat tanpa pemilik. Guard di baris
    // `if (host == address(0)) revert BadSignature();` wajib menangkapnya
    // lebih dulu, sebelum tanda tangan sempat diperiksa.
    function test_buatEventAlamatNolDitolak() public {
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.createEvent(
            keccak256("event-host-nol"), address(0), startsAt, endsAt, CELL, expiresAt, hex"00"
        );
    }

    // Setiap test lain menurunkan digestnya dari reg.DOMAIN_SEPARATOR() itu
    // sendiri, jadi domain EIP-712 yang salah pun tetap lolos semua test.
    // Test ini menghitung separator secara independen dan membandingkannya —
    // kalau nama, versi, chainId, atau verifyingContract di kontrak berubah
    // diam-diam, ini satu-satunya test yang akan menangkapnya.
    function test_domainSeparatorDihitungBenar() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("Nearly"),
                keccak256("1"),
                block.chainid,
                address(reg)
            )
        );
        assertEq(reg.DOMAIN_SEPARATOR(), expected);
    }
}
