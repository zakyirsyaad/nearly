// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Event dan kehadiran terverifikasi.
 *
 * Pola dua tanda tangan diambil dari ConnectionRegistry, dan alasannya sama:
 * kehadiran adalah pertemuan antara DUA pihak, jadi keduanya harus menyetujui.
 * `sigHost` membuktikan host membuka pintu; `sigAttendee` membuktikan tamu
 * melangkah masuk. Relayer hanya membayar gas — ia tidak bisa mengarang event
 * atas nama orang lain, dan tidak bisa mencetak kehadiran orang yang tidak
 * menandatanganinya.
 *
 * YANG DITEGAKKAN KONTRAK: event harus ada, waktu harus di dalam jendela,
 * kedua tanda tangan sah dan tidak malleable, nonce sekali pakai, satu
 * kehadiran per orang per event, selamanya.
 *
 * YANG TIDAK DITEGAKKAN KONTRAK: geofence. Kontrak tidak punya cara mengetahui
 * di mana perangkat berada, jadi di situ server yang menjadi saksi (spec §7.2).
 * Jangan mengklaim geofence terjamin on-chain.
 */
contract AttendanceRegistry {
    error NotAttestor();
    error ZeroAddress();
    error EventExists();
    error EventUnknown();
    error BadWindow();
    error Expired();
    error BadSignature();
    error NotLive();
    error NonceUsed();
    error AlreadyCheckedIn();

    // WAJIB identik dengan EVENT_TYPES di packages/shared/src/event.ts.
    // Dijaga test kunci di packages/shared/test/event-typehash.test.ts.
    bytes32 private constant CREATE_EVENT_TYPEHASH = keccak256(
        "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
    );
    bytes32 private constant CHECKIN_OFFER_TYPEHASH =
        keccak256("CheckInOffer(bytes32 eventId,bytes32 nonce,uint64 expiresAt)");
    bytes32 private constant CHECKIN_ACCEPT_TYPEHASH = keccak256(
        "CheckInAccept(bytes32 eventId,bytes32 nonce,address attendee,uint64 expiresAt)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;
    address public immutable attestor;

    struct EventRecord {
        address host;
        uint64 startsAt;
        uint64 endsAt;
        bytes32 centerCell;
    }

    mapping(bytes32 => EventRecord) public events;
    /// eventId => hadir => detik unix. Nol berarti belum pernah hadir.
    mapping(bytes32 => mapping(address => uint64)) public attendedAt;
    mapping(bytes32 => bool) public usedNonce;

    event EventCreated(
        bytes32 indexed eventId, address indexed host, uint64 startsAt, uint64 endsAt
    );
    event CheckedIn(bytes32 indexed eventId, address indexed attendee, uint64 at);

    constructor(address _attestor) {
        if (_attestor == address(0)) revert ZeroAddress();
        attestor = _attestor;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256("Nearly"), keccak256("1"), block.chainid, address(this)
            )
        );
    }

    function createEvent(
        bytes32 eventId,
        address host,
        uint64 startsAt,
        uint64 endsAt,
        bytes32 centerCell,
        uint64 expiresAt,
        bytes calldata sigHost
    ) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (host == address(0)) revert BadSignature();
        if (endsAt <= startsAt) revert BadWindow();
        if (block.timestamp > expiresAt) revert Expired();
        if (events[eventId].host != address(0)) revert EventExists();

        bytes32 digest = _digest(
            keccak256(
                abi.encode(
                    CREATE_EVENT_TYPEHASH, eventId, host, startsAt, endsAt, centerCell, expiresAt
                )
            )
        );
        if (_recover(digest, sigHost) != host) revert BadSignature();

        events[eventId] =
            EventRecord({host: host, startsAt: startsAt, endsAt: endsAt, centerCell: centerCell});
        emit EventCreated(eventId, host, startsAt, endsAt);
    }

    function checkIn(
        bytes32 eventId,
        address attendee,
        bytes32 nonce,
        uint64 expiresAt,
        bytes calldata sigHost,
        bytes calldata sigAttendee
    ) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (attendee == address(0)) revert BadSignature();

        EventRecord memory e = events[eventId];
        if (e.host == address(0)) revert EventUnknown();
        if (block.timestamp < e.startsAt || block.timestamp > e.endsAt) revert NotLive();
        if (block.timestamp > expiresAt) revert Expired();
        if (usedNonce[nonce]) revert NonceUsed();
        if (attendedAt[eventId][attendee] != 0) revert AlreadyCheckedIn();

        bytes32 offerDigest =
            _digest(keccak256(abi.encode(CHECKIN_OFFER_TYPEHASH, eventId, nonce, expiresAt)));
        if (_recover(offerDigest, sigHost) != e.host) revert BadSignature();

        bytes32 acceptDigest = _digest(
            keccak256(abi.encode(CHECKIN_ACCEPT_TYPEHASH, eventId, nonce, attendee, expiresAt))
        );
        if (_recover(acceptDigest, sigAttendee) != attendee) revert BadSignature();

        usedNonce[nonce] = true;
        attendedAt[eventId][attendee] = uint64(block.timestamp);
        emit CheckedIn(eventId, attendee, uint64(block.timestamp));
    }

    function hasAttended(bytes32 eventId, address who) external view returns (bool) {
        return attendedAt[eventId][who] != 0;
    }

    function _digest(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", DOMAIN_SEPARATOR, structHash));
    }

    /// Setengah orde kurva secp256k1. Di atas ini, tanda tangan malleable.
    uint256 private constant HALF_N =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

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
        if (v < 27) v += 27;
        if (uint256(s) > HALF_N) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
