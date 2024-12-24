import privacyEn from "./privacy.en";
import termsEn from "./terms.en";
import faqEn from "./faq.en.json";

export const messages = {
  en: {
    homepage: {
      title: "AtomOne Staking Portal",
      intro:
        "Explore the Governance dApp—a seamlessly integrated interface empowering secure and efficient governance interactions with the GovGen chain. Engage in collaborative discussions in the {0} and actively participate in the governance processes to shape the potential future of AtomOne.",
      proposalsHeader: "All Proposals",
      forumLinkText: "forum",
      website: "Website",
      createProposal: "Create Proposal",
      viewHistory: "Voting History",
      viewProposals: "Proposals",
      viewFaq: "FAQ",
      viewForums: "Forum",
      viewAuditStatus: "View Audit Status",
      security: "Security",
      auditStatus:
        "Your security is our priority! Click below to view this application's latest audit status and see how we’re working to keep you safe. We encourage you to check the audit status regularly before using the application to ensure you’re always up-to-date on our security measures.",
    },
    termspage: {
      title: "Terms of Service",
      content: termsEn,
    },
    faqPage: {
      title: "FAQ",
      content: faqEn,
    },
    privacypage: {
      title: "Privacy Policy",
      content: privacyEn,
    },
    voteHistory: {
      title: "Voting History",
      walletLbl: "Your wallet address",
      walletCta: "Please connect your wallet or your wallet address to see your voting history",
      activeHeader: "Active Proposals",
      pastHeader: "Past Proposals",
      columns: {
        name: "Name",
        type: "Type",
        status: "Status",
        vote: "Vote",
        voted: "Voted",
        deposited: "Deposited",
        stake: "Vote Stake",
        voteTime: "Voted/Overridden",
      },
    },
    voteOptions: {
      yes: "Yes",
      no: "No",
      nwv: "No with veto",
      nwvShort: "Veto",
      abstain: "Abstain",
      VOTE_OPTION_YES: "Yes",
      VOTE_OPTION_NO: "No",
      VOTE_OPTION_ABSTAIN: "Abstain",
      VOTE_OPTION_NO_WITH_VETO: "No With Veto",
    },
    propType: (ctx: string): string => {
      switch (ctx) {
        case "/cosmos.params.v1beta1.ParameterChangeProposal":
          return "Param Change";
        case "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal":
          return "Software Upgrade";
        case "/govgen.gov.v1beta1.TextProposal":
        default:
          return "Text";
      }
    },
    propStatus: {
      PROPOSAL_STATUS_PASSED: "Passed",
      PROPOSAL_STATUS_REJECTED: "Rejected",
      PROPOSAL_STATUS_DEPOSIT_PERIOD: "Depositing",
      PROPOSAL_STATUS_VOTING_PERIOD: "Ends in {days} days",
      PROPOSAL_STATUS_FAILED: "Failed",
      PROPOSAL_STATUS_INVALID: "Invalid",
      PROPOSAL_STATUS_UNSPECIFIED: "Unspecified",
    },
    proposalcreate: {
      transaction: "Transaction",
      back: "Back",
      typeText: "Text",
      typeParameterChange: "Parameter Change",
      typeUpgrade: "Upgrade",
      chooseType: "Choose Type",
      title: "Proposal Title",
      description: "Description",
      index: "Index",
      changes: "Changes",
      addParameter: "Add Parameter",
      blockHeight: "Block Height",
      blockInfo: "Block Info",
      upgradeName: "Upgrade Name",
      proposalTypeParam: "Parameter Change Proposal",
      proposalTypeUpgrade: "Upgrade Proposal",
      proposalTypeText: "Text Proposal",
      proposalCTA: "Create",
      proposalWallet: "Connect Wallet",
    },
    proposalpage: {
      badges: {
        votingPeriod: "Voting Period",
        depositPeriod: "Deposit Period",
        quorumPending: "Quorum not reached",
        depositPending: "Deposit not reached",
        depositFailed: "Deposit not met",
        passed: "Passed",
        rejected: "Rejected",
      },
      labels: {
        turnOut: "Turnout",
        quorum: "Quorum",
        result: "Proposal result",
        expectedResult: "Expected proposal result",
        proposalDescription: "Proposal Description",
        validatorQuota: "Validator Quota",
        title: "Title",
        description: "Description",
        proposer: "Proposer",
        votingStart: "Voting start",
        votingEnd: "Voting end",
        submitTime: "Submit time",
        depositEnd: "Deposit end",
        initialDeposit: "Initial deposit",
        totalDeposit: "Total deposit",
        messages: "Messages",
        changes: "Changes",
        proposalType: "Proposal type",
        upgradePlan: "Upgrade plan",
        noValidatorVotes: "No validators have voted yet...",
        validators: "Validators",
        validatorsVoted: "Validators Voted",
        accountsAll: "All Voters",
        accountsVoted: "Accounts Voted",
      },
      types: {
        text: "Text proposal",
        paramChange: "Parameter change proposal",
        upgrade: "Software upgrade proposal",
      },
      results: {
        passed: "Passed",
        failed: "Failed",
        rejected: "Rejected",
        willPass: "Will pass",
        willReject: "Will be rejected",
        willFail: "Will fail",
      },
    },
    proposalview: {
      labels: {
        unavailable: "Proposal is unavailable",
      },
    },
    components: {
      ErrorBox: {
        title: "Error",
        message: "Something went wrong...",
        cta: "Please refresh",
      },
      WalletConnect: {
        button: "Connect Wallet",
        cta: "Connect your wallet",
        ctaAddress: "Connect Address",
        balance: "Balance",
        cancel: "Cancel",
        disconnect: "Disconnect wallet",
        connecting: "Connecting wallet",
        wait: "Please wait...",
        trouble: "Troubleshooting",
        retry: "Try again",
        failed: "Connection Failed",
        failedSub: "Was not able to connect to your wallet",
        publicAddressDisclaimer:
          "* Connecting public address doesn't connect to your wallet and is used only for CLI command generation.",
        recommendedWallet: "We recommend connecting with address only",
        otherWallet: "or connect your Wallet. Make sure you have a wallet browser extension enabled.",
        enterAddress: "Enter your AtomOne wallet address",
        addressPlaceholder: "e.g. atone1ad453f23bc2d...",
      },
      Breakdown: {
        moniker: "Moniker",
        voter: "Voter",
        answer: "Answer",
        txHash: "TX Hash",
        weight: "Weight",
        time: "Time",
        hasNotVoted: "HAS NOT VOTED",
      },
      FooterSection: {
        cta: "Be a part of the conversation",
      },
      Search: {
        placeholder: "Search Proposal",
      },
      Delegate: {
        cta: "Stake",
        delegated: "You staked",
        error: "Error",
      },
      Claim: {
        cta: "Claim Rewards",
        ctamulti: "Claim All Rewards",
        claimed: "Claimed Rewards",
        error: "Error",
      },
      Redelegate: {
        cta: "Redelegate",
        redelegated: "You redelegated",
        error: "Error",
      },
      Undelegate: {
        cta: "Unstake",
        undelegated: "You unstaked",
        error: "Error",
      },
      ProposalVote: {
        cta: "Vote",
        voted: "You voted",
        error: "Error",
        weightedInstructions: "Define weight for each of the voting options. The sum of weights must be equal to 1.",
      },
      ProposalDeposit: {
        cta: "Deposit",
        act: "deposited",
        deposited: "You deposited",
        error: "Error",
        instructions: "Enter deposit amount",
      },
      VotePanel: {
        breakdown: "Breakdown",
        noVotes: "No votes have been recorded.",
      },
      GithubComments: {
        signInLong: "Sign in via GitHub to be able to post messages",
        signIn: "Github Sign In",
        signOut: "Sign Out",
        proposalDiscussion: "Proposal Discussion",
        upvoteRatio: "Upvote Ratio",
        totalComments: "Total Comment(s)",
        viewOnGithub: "View on GitHub",
        postComment: "Post Comment",
      },
      GithubLinks: {
        communityLinks: "Community Links",
        signIn: "GitHub Sign In",
        signOut: "GitHub Sign Out",
        addLink: "Add Link",
        upvoteRatio: "Upvote Ratio",
        totalLinks: "Total Link(s)",
        link: "Link",
        invalidHttpsLink: "Link is not valid, must be HTTPS",
        invalidLinkContentLength: "Content length must be at least 32 characters",
        cancel: "Cancel",
        post: "Post",
      },
    },
    ui: {
      readMore: "Read More",
      readLess: "Read Less",
      actions: {
        cli: "Copy CLI Command",
        confirm: "or Sign with Wallet",
        signTxSecurely: "See: Why and How should I use the CLI?",
        cancel: "Cancel",
        clicta: "CLI Command",
        copied: "Copied",
        copy: "Copy",
        back: "Back",
        done: "Done",
      },
      buttons: {
        back: "Back",
      },
      tabs: {
        Info: "Info",
        Voters: "Voters",
        Discussions: "Discussions",
        Description: "Description",
        Links: "Links",
        Yes: "Yes",
        No: "No",
        Veto: "Veto",
        Abstain: "Abstain",
      },
    },
  },
};
