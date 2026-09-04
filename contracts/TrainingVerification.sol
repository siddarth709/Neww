pragma solidity ^0.8.24;

contract TrainingVerification {
    struct Commitment {
        bytes32 commitHash;
        uint256 committedAt;
        bool revealed;
    }

    struct GradientUpdate {
        address node;
        uint256 round;
        bytes32 gradientHash;
        string ipfsCID;
        uint256 timestamp;
        bool verified;
        bool flaggedMalicious;
    }

    struct TrainingRound {
        uint256 roundId;
        uint256 startedAt;
        uint256 endedAt;
        bytes32 aggregatedModelHash;
        uint256 acceptedUpdates;
        uint256 rejectedUpdates;
    }

    address public owner;
    uint256 public currentRound;

    mapping(address => Commitment) public commitments;
    mapping(uint256 => GradientUpdate[]) public roundUpdates;
    mapping(uint256 => TrainingRound) public rounds;
    mapping(address => int256) public reputation;
    mapping(address => bool) public registeredNodes;

    event NodeRegistered(address indexed node);
    event GradientCommitted(address indexed node, uint256 indexed round, bytes32 commitHash);
    event GradientRevealed(address indexed node, uint256 indexed round, bytes32 gradientHash, string ipfsCID);
    event GradientFlagged(address indexed node, uint256 indexed round, string reason);
    event RoundFinalized(uint256 indexed round, bytes32 aggregatedModelHash, uint256 accepted, uint256 rejected);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyRegistered() {
        require(registeredNodes[msg.sender], "node not registered");
        _;
    }

    constructor() {
        owner = msg.sender;
        currentRound = 1;
        rounds[currentRound].roundId = currentRound;
        rounds[currentRound].startedAt = block.timestamp;
    }

    function registerNode(address node) external onlyOwner {
        registeredNodes[node] = true;
        reputation[node] = 100;
        emit NodeRegistered(node);
    }

    function commitGradient(bytes32 commitHash) external onlyRegistered {
        commitments[msg.sender] = Commitment({
            commitHash: commitHash,
            committedAt: block.timestamp,
            revealed: false
        });
        emit GradientCommitted(msg.sender, currentRound, commitHash);
    }

    function revealGradient(bytes32 gradientHash, uint256 nonce, string calldata ipfsCID) external onlyRegistered {
        Commitment storage c = commitments[msg.sender];
        require(c.commitHash != bytes32(0), "no commitment found");
        require(!c.revealed, "already revealed");

        bytes32 check = keccak256(abi.encodePacked(gradientHash, nonce, msg.sender));
        require(check == c.commitHash, "reveal does not match commitment");

        c.revealed = true;
        roundUpdates[currentRound].push(GradientUpdate({
            node: msg.sender,
            round: currentRound,
            gradientHash: gradientHash,
            ipfsCID: ipfsCID,
            timestamp: block.timestamp,
            verified: true,
            flaggedMalicious: false
        }));
        emit GradientRevealed(msg.sender, currentRound, gradientHash, ipfsCID);
    }

    function flagGradient(address node, uint256 round, uint256 updateIndex, string calldata reason) external onlyOwner {
        GradientUpdate storage u = roundUpdates[round][updateIndex];
        require(u.node == node, "index/node mismatch");
        u.flaggedMalicious = true;
        u.verified = false;
        reputation[node] -= 25;
        if (reputation[node] < -100) {
            registeredNodes[node] = false;
        }
        emit GradientFlagged(node, round, reason);
    }

    function rewardHonestContribution(address node) external onlyOwner {
        reputation[node] += 5;
    }

    function finalizeRound(bytes32 aggregatedModelHash) external onlyOwner {
        TrainingRound storage r = rounds[currentRound];
        r.endedAt = block.timestamp;
        r.aggregatedModelHash = aggregatedModelHash;
        uint256 accepted;
        uint256 rejected;
        GradientUpdate[] storage updates = roundUpdates[currentRound];
        for (uint256 i = 0; i < updates.length; i++) {
            if (updates[i].verified && !updates[i].flaggedMalicious) {
                accepted++;
            } else {
                rejected++;
            }
        }
        r.acceptedUpdates = accepted;
        r.rejectedUpdates = rejected;

        emit RoundFinalized(currentRound, aggregatedModelHash, accepted, rejected);
        currentRound += 1;
        rounds[currentRound].roundId = currentRound;
        rounds[currentRound].startedAt = block.timestamp;
    }

    function getTrainingHistory(uint256 round) external view returns (GradientUpdate[] memory) {
        return roundUpdates[round];
    }

    function getRound(uint256 round) external view returns (TrainingRound memory) {
        return rounds[round];
    }

    function getReputation(address node) external view returns (int256) {
        return reputation[node];
    }
}
