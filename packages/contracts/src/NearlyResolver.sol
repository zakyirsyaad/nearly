// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IConnections {
    function isConnected(address x, address y) external view returns (bool);
}

interface IVouches {
    function slashed(address subject) external view returns (bool);
}

interface IAttestor {
    function scores(address who) external view returns (uint32 score, uint8 tier, uint64 at);
}

/**
 * Antarmuka baca untuk dApp lain (spec induk §10.3).
 *
 * Inilah titik di mana Nearly berhenti menjadi aplikasi dan menjadi primitif
 * reputasi yang bisa dipakai orang lain: satu alamat, empat pertanyaan, tanpa
 * perlu tahu ada tiga kontrak di belakangnya.
 *
 * HANYA BACA. Tidak ada satu pun fungsi yang mengubah state.
 */
contract NearlyResolver {
    IConnections public immutable connections;
    IVouches public immutable vouches;
    IAttestor public immutable attestor;

    constructor(address _connections, address _vouches, address _attestor) {
        connections = IConnections(_connections);
        vouches = IVouches(_vouches);
        attestor = IAttestor(_attestor);
    }

    /// Rasio x 1.000.000. Alamat yang belum pernah dihitung bernilai 0.
    function getTrust(address who) external view returns (uint32) {
        (uint32 score,,) = attestor.scores(who);
        return score;
    }

    /// 0 Baru, 1 Dikenal, 2 Terpercaya, 3 Inti.
    function getTier(address who) external view returns (uint8) {
        (, uint8 tier,) = attestor.scores(who);
        return tier;
    }

    function isSlashed(address who) external view returns (bool) {
        return vouches.slashed(who);
    }

    function isConnected(address x, address y) external view returns (bool) {
        return connections.isConnected(x, y);
    }
}
