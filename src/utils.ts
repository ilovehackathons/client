import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, BN, Program } from "@project-serum/anchor";
import { MintInfo, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getMarket } from "./markets";
import { findMarketPositionPda } from "./market_position";
import { findMarketMatchingPoolPda } from "./market_matching_pools";
import { findMarketOutcomePda } from "./market_outcomes";
import {
  ClientResponse,
  ResponseFactory,
  FindPdaResponse,
  StakeInteger,
} from "../types";
import { MarketAccountsForCreateBetOrder } from "../types";

/**
 * For the provided market, outcome, odds and backing condition - return all the necessary PDAs and account information required for betOrder creation.
 *
 * @param program {program} anchor program initialized by the consuming client
 * @param marketPk {PublicKey} publicKey of a market
 * @param backing {boolean} bool representing backing or laying a market
 * @param marketOutcomeIndex {number} index representing the chosen outcome of a market
 * @param odds {number} odds for betOrder
 * @returns {PublicKey, MarketAccount} publicKey PDAs for the escrow, marketOutcome, outcomePool and marketPosition accounts as well as the full marketAccount.
 *
 * @example
 *
 * const marketPk = new PublicKey('7o1PXyYZtBBDFZf9cEhHopn2C9R4G6GaPwFAxaNWM33D')
 * const backing = true
 * const marketOutcomeIndex = 0
 * const odds = 5.9
 * const marketAccounts = await getMarketAccounts(program, marketPK, backing, marketOutcomeIndex, odds)
 */
export async function getMarketAccounts(
  program: Program,
  marketPk: PublicKey,
  backing: boolean,
  marketOutcomeIndex: number,
  odds: number,
): Promise<ClientResponse<MarketAccountsForCreateBetOrder>> {
  const response = new ResponseFactory({} as MarketAccountsForCreateBetOrder);
  const market = await getMarket(program, marketPk);

  if (!market.success) {
    response.addErrors(market.errors);
    return response.body;
  }

  const outcomes = market.data.account.marketOutcomes;
  const provider = program.provider as AnchorProvider;

  const [marketOutcomePda, marketOutcomePoolPda, marketPositionPda, escrowPda] =
    await Promise.all([
      findMarketOutcomePda(program, marketPk, outcomes[marketOutcomeIndex]),
      findMarketMatchingPoolPda(
        program,
        marketPk,
        outcomes[marketOutcomeIndex],
        odds,
        backing,
      ),
      findMarketPositionPda(program, marketPk, provider.wallet.publicKey),
      findEscrowPda(program, marketPk),
    ]);

  const responseData = {
    escrowPda: escrowPda.data.pda,
    marketOutcomePda: marketOutcomePda.data.pda,
    marketOutcomePoolPda: marketOutcomePoolPda.data.pda,
    marketPositionPda: marketPositionPda.data.pda,
    market: market.data.account,
  };

  response.addResponseData(responseData);

  return response.body;
}

/**
 * For the provided stake and market, get a BN representation of the stake adjusted for the decimals on that markets token.
 *
 * @param program {program} anchor program initialized by the consuming client
 * @param stake {number} ui stake amount, i.e. how many tokens a wallet wishes to stake on an outcome
 * @param marketPk {PublicKey} publicKey of a market
 * @returns {BN} ui stake adjusted for the market token decimal places
 *
 * @example
 *
 * const uiStake = await uiStakeToInteger(20, new PublicKey('7o1PXyYZtBBDFZf9cEhHopn2C9R4G6GaPwFAxaNWM33D'), program)
 * // returns 20,000,000,000 represented as a BN for a token with 9 decimals
 */
export async function uiStakeToInteger(
  program: Program,
  stake: number,
  marketPk: PublicKey,
): Promise<ClientResponse<StakeInteger>> {
  const response = new ResponseFactory({});
  const market = await getMarket(program, marketPk);

  if (!market.success) {
    response.addErrors(market.errors);
    return response.body;
  }

  const marketTokenPk = new PublicKey(market.data.account.mintAccount);
  const mintInfo = await getMintInfo(program, marketTokenPk);

  if (!mintInfo.success) {
    response.addErrors(mintInfo.errors);
    return response.body;
  }

  const stakeInteger = new BN(stake * 10 ** mintInfo.data.decimals);
  response.addResponseData({
    stakeInteger: stakeInteger,
  });
  return response.body;
}

/**
 * For the provided market publicKey, return the escrow account PDA (publicKey) for that market.
 *
 * @param program {program} anchor program initialized by the consuming client
 * @param marketPk {PublicKey} publicKey of a market
 * @returns {FindPdaResponse} PDA of the escrow account
 *
 * @example
 *
 * const marketPk = new PublicKey('7o1PXyYZtBBDFZf9cEhHopn2C9R4G6GaPwFAxaNWM33D')
 * const escrowPda = await findEscrowPda(program, marketPK)
 */
export async function findEscrowPda(
  program: Program,
  marketPk: PublicKey,
): Promise<ClientResponse<FindPdaResponse>> {
  const response = new ResponseFactory({} as FindPdaResponse);
  try {
    const [pda, _] = await PublicKey.findProgramAddress(
      [Buffer.from("escrow"), marketPk.toBuffer()],
      program.programId,
    );
    response.addResponseData({
      pda: pda,
    });
  } catch (e) {
    response.addError(e);
  }
  return response.body;
}

/**
 * For the provided spl-token, get the mint info for that token.
 *
 * @param program {program} anchor program initialized by the consuming client
 * @param mintPK {PublicKey} publicKey of an spl-token
 * @returns {MintInfo} mint information including mint authority and decimals
 *
 * @example
 *
 * const mintPk = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')
 * const getMintInfo = await findEscrowPda(program, mintPk)
 */
export async function getMintInfo(
  program: Program,
  mintPK: PublicKey,
): Promise<ClientResponse<MintInfo>> {
  const response = new ResponseFactory({} as MintInfo);

  const provider = program.provider as AnchorProvider;
  const wallet = provider.wallet as NodeWallet;
  const mint = new Token(
    program.provider.connection,
    mintPK,
    TOKEN_PROGRAM_ID,
    wallet.payer,
  );

  try {
    const mintInfo = await mint.getMintInfo();
    response.addResponseData(mintInfo);
  } catch (e) {
    response.addError(e);
  }

  return response.body;
}