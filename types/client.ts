import { PublicKey } from "@solana/web3.js";

export type ClientResponse<T> = {
  success: boolean;
  errors: object[];
  data: T;
};

export type CreateBetOrderResponse = {
  betOrderPk: PublicKey;
  tnxID: string | void;
};

export type FindPdaResponse = {
  pda: PublicKey;
};

export class ResponseFactory {
  success: boolean;
  errors: object[];
  data: any;

  /**
   * Helper to construct a client response object, each endpoint should return a response in this format
   *
   * @param opts.responseData empty object set to the response type
   *
   * @example
   *  const response = new ResponseFactory({} as BetOrderAccounts);
   *  return response.body
   */
  constructor(opts) {
    this.success = true;
    this.errors = [];
    this.data = opts.responseData;
  }

  failure() {
    this.success = false;
  }

  /**
   * Add an error to the response body and mark the response as failed
   *
   * @param error {any} error to add, there is currently no type validation so anything can be pushed through
   *
   * @example
   *  const response = new ResponseFactory({} as BetOrderAccounts);
   *  try {
   *      performAction()
   *  }
   *  catch (e) {
   *      response.addError(e)
   *  }
   *  return response.body
   */
  addError(error) {
    this.errors.push(error);
    this.failure();
  }

  /**
   * Add a errors to the response body and mark the response as failed, used primarily with previous client responses
   *
   * @param errors {any[]} errors array to add, there is currently no type validation so anything can be pushed through
   *
   * @example
   *  const response = new ResponseFactory({} as BetOrderAccounts);
   *  const secondaryRequest = separateRequest()
   *  if (!secondaryRequest.success){
   *     response.addErrors(secondaryRequest.errors)
   *     return response.body
   *  }
   *  return response.body
   */
  addErrors(errors) {
    this.errors.push(...errors);
    this.failure();
  }

  /**
   * Add response data to the response following the format set with the constructor
   *
   * @param responseData {object} object making up part of or the whole of the expected responseData
   *
   * @example
   *  const response = new ResponseFactory({} as BetOrderAccounts);
   *  response.addResponseData({
   *      betOrderPk: <publicKey>
   *  })
   * return response.body
   */
  addResponseData(responseData: object) {
    this.data = {
      ...this.data,
      ...responseData,
    };
  }

  get body() {
    return {
      success: this.success,
      errors: this.errors,
      data: this.data,
    };
  }
}
