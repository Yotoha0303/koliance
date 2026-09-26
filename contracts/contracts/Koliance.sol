// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

contract Koliance {

    struct Identity {
        bool exists;
        uint256 createdAt;
        string metadataHash;
    }

    struct TrustRecord {
        address from;
        address to;
        string action;
        bytes32 proof;
        uint256 timestamp;
    }

    mapping(address => Identity) public identities;
    TrustRecord[] public records;

    // Events for real-time frontend and indexer listening
    event IdentityRegistered(address indexed user, uint256 timestamp, string metadataHash);
    event TrustAdded(address indexed from, address indexed to, string action, bytes32 proof, uint256 timestamp);

    function register(string calldata metadataHash) external {
        identities[msg.sender] = Identity(
            true,
            block.timestamp,
            metadataHash
        );
        emit IdentityRegistered(msg.sender, block.timestamp, metadataHash);
    }

    function addTrust(
        address to,
        string calldata action,
        bytes32 proof
    ) external {
        TrustRecord memory newRecord = TrustRecord(
            msg.sender,
            to,
            action,
            proof,
            block.timestamp
        );
        records.push(newRecord);
        emit TrustAdded(msg.sender, to, action, proof, block.timestamp);
    }

    function getRecordsCount() external view returns (uint256) {
        return records.length;
    }

    function getAllRecords() external view returns (TrustRecord[] memory) {
        return records;
    }
}
