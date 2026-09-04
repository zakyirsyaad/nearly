// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";

contract Deploy is Script {
    function run() external returns (ConnectionRegistry reg) {
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        vm.startBroadcast();
        reg = new ConnectionRegistry(attestor);
        vm.stopBroadcast();
    }
}
