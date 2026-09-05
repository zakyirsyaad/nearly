// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";
import {NearlyResolver} from "../src/NearlyResolver.sol";
import {TrustAttestor} from "../src/TrustAttestor.sol";
import {VouchRegistry} from "../src/VouchRegistry.sol";
import {AttendanceRegistry} from "../src/AttendanceRegistry.sol";

/**
 * ConnectionRegistry sudah ter-deploy sejak Fase 1 dan TIDAK boleh di-deploy
 * ulang — mencetaknya lagi akan mengosongkan seluruh graf koneksi yang sudah
 * ada. Alamatnya dibaca dari env.
 */
contract DeployPhase2 is Script {
    function run()
        external
        returns (VouchRegistry vouch, TrustAttestor attestorContract, NearlyResolver resolver)
    {
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        address connections = vm.envAddress("CONNECTION_REGISTRY_ADDRESS");

        vm.startBroadcast();
        vouch = new VouchRegistry(attestor, connections);
        attestorContract = new TrustAttestor(attestor);
        resolver = new NearlyResolver(connections, address(vouch), address(attestorContract));
        vm.stopBroadcast();
    }
}

/**
 * Fase 3a. Berdiri sendiri: AttendanceRegistry tidak bergantung pada kontrak
 * lain mana pun, jadi men-deploy-nya tidak menyentuh graf koneksi maupun vouch
 * yang sudah ada.
 */
contract DeployPhase3a is Script {
    function run() external returns (AttendanceRegistry attendance) {
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        vm.startBroadcast();
        attendance = new AttendanceRegistry(attestor);
        vm.stopBroadcast();
    }
}
