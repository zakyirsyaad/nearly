// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Publikasi Trust Score.
 *
 * Skor dihitung off-chain di packages/trust lalu diterbitkan ke sini. Yang
 * membuat ini layak on-chain: setiap koneksi juga on-chain, jadi siapa pun bisa
 * MENGHITUNG ULANG skor dari graf publik dan membuktikan angka di sini tidak
 * dikarang (spec induk §10.3).
 *
 * Event ScoreUpdated dipancarkan di setiap penulisan, sehingga seluruh riwayat
 * skor bisa direkonstruksi dari log tanpa perlu arsip terpisah.
 */
contract TrustAttestor {
    error NotAttestor();
    error BadTier();
    error BadScore();
    error ZeroAddress();

    /// Solidity tidak punya desimal: rasio 0.15 disimpan sebagai 150000.
    uint32 public constant SCORE_SCALE = 1_000_000;

    struct Score {
        uint32 score;
        uint8 tier;
        uint64 at;
    }

    address public immutable attestor;
    mapping(address => Score) public scores;

    event ScoreUpdated(address indexed who, uint32 score, uint8 tier, uint64 at);

    constructor(address _attestor) {
        // attestor immutable: salah ketik saat deploy tidak bisa diperbaiki,
        // dan address(0) membuat setScore mustahil dipanggil selamanya.
        if (_attestor == address(0)) revert ZeroAddress();
        attestor = _attestor;
    }

    function setScore(address who, uint32 score, uint8 tier) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (tier > 3) revert BadTier();
        if (score > SCORE_SCALE) revert BadScore();

        scores[who] = Score({score: score, tier: tier, at: uint64(block.timestamp)});
        emit ScoreUpdated(who, score, tier, uint64(block.timestamp));
    }
}
