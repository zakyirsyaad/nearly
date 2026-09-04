// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TrustAttestor} from "../src/TrustAttestor.sol";

contract TrustAttestorTest is Test {
    TrustAttestor att;
    address attestor = address(0xA77E);
    address who = address(0xBEEF);

    event ScoreUpdated(address indexed who, uint32 score, uint8 tier, uint64 at);

    function setUp() public {
        att = new TrustAttestor(attestor);
    }

    function test_setScore_menyimpan_skor_dan_tier() public {
        vm.prank(attestor);
        att.setScore(who, 150_000, 2);

        (uint32 score, uint8 tier, uint64 at) = att.scores(who);
        assertEq(score, 150_000);
        assertEq(tier, 2);
        assertEq(at, uint64(block.timestamp));
    }

    function test_setScore_bukan_attestor_gagal() public {
        vm.expectRevert(TrustAttestor.NotAttestor.selector);
        att.setScore(who, 1, 1);
    }

    function test_setScore_tier_di_luar_rentang_gagal() public {
        vm.expectRevert(TrustAttestor.BadTier.selector);
        vm.prank(attestor);
        att.setScore(who, 1, 4);
    }

    function test_setScore_skor_melebihi_skala_gagal() public {
        vm.expectRevert(TrustAttestor.BadScore.selector);
        vm.prank(attestor);
        att.setScore(who, 1_000_001, 3);
    }

    function test_setScore_memancarkan_event() public {
        vm.expectEmit(true, false, false, true);
        emit ScoreUpdated(who, 450_000, 3, uint64(block.timestamp));
        vm.prank(attestor);
        att.setScore(who, 450_000, 3);
    }

    function test_setScore_menimpa_nilai_lama() public {
        vm.prank(attestor);
        att.setScore(who, 10_000, 0);
        vm.prank(attestor);
        att.setScore(who, 500_000, 3);

        (uint32 score, uint8 tier,) = att.scores(who);
        assertEq(score, 500_000);
        assertEq(tier, 3);
    }

    function test_alamat_yang_belum_pernah_ditulis_bernilai_nol() public view {
        (uint32 score, uint8 tier, uint64 at) = att.scores(address(0xDEAD));
        assertEq(score, 0);
        assertEq(tier, 0);
        assertEq(at, 0);
    }

    function test_konstruktor_menolak_attestor_nol() public {
        vm.expectRevert(TrustAttestor.ZeroAddress.selector);
        new TrustAttestor(address(0));
    }

    function test_skala_penuh_diterima() public {
        vm.prank(attestor);
        att.setScore(who, 1_000_000, 3);
        (uint32 score,,) = att.scores(who);
        assertEq(score, 1_000_000);
    }
}
