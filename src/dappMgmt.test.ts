import casual from 'casual';
import DappbotAPI from '@eximchain/dappbot-api-client';
import { getConfiguredAPI, testConfig, DummyDappName, DummyCreateDappArg, getAuthFileData, setAuthFileData, sleep, DEFAULT_API_URL } from './common';
import User from '@eximchain/dappbot-types/spec/user';
import Responses from '@eximchain/dappbot-types/spec/responses';
import Dapp from '@eximchain/dappbot-types/spec/dapp';

/**
 * Verify that all dapp management calls are behaving
 * appropriately.  For the sake of convenience, this
 * test suite assumes it has access to a fully initialized
 * user.
 */
let DappName:string, username:string, password:string;
let API:DappbotAPI;
let DappbotURL = DEFAULT_API_URL;

beforeAll(() => {
  const conf = testConfig();
  DappbotURL = conf.apiUrl || DEFAULT_API_URL;
  console.log(`\nAbout to run test against ${DappbotURL} ...`);
  username = conf.username;
  password = conf.password;
})

beforeEach(() => {
  API = getConfiguredAPI(getAuthFileData(), DappbotURL);
})

describe('Dapp Management User Story', function(){

  test('Login: Valid credentials returns success response', async () => {
    const response = await API.auth.login.call({ username, password });
    expect(response).toBeSuccessResponse();
    if (!Responses.isSuccessResponse(response)) return;
    expect(response.data).toBeAuthData();
    if (!User.isAuthData(response.data)) return;
    setAuthFileData(response.data);
  })

  test.todo('Login: Validate the shape of an invalid creds response');

  test('CreateDapp: Valid args produce a successful message response', async () => {
    DappName = DummyDappName()
    const arg = DummyCreateDappArg();
    const createResponse = await API.private.createDapp.call(DappName, arg);
    expect(createResponse).toBeSuccessResponse();
    if (!Responses.isSuccessResponse(createResponse)) return;
    expect(createResponse.data).toBeMessageResult();
  })

  test.todo('CreateDapp: Invalid args produce correct error responses');

  test('ReadDapp: Created Dapp has a valid DB record', async () => {
    let readRes = await API.private.readDapp.call(DappName);
    if (typeof readRes === 'string') readRes = JSON.parse(readRes);
    expect(readRes).toBeSuccessResponse();
    if (!Responses.isSuccessResponse(readRes)) return;
    expect(readRes.data.exists).toEqual(true);
    expect(readRes.data.item).toBeItemApi();
  })

  test.todo('ReadDapp: Implement checking the dapp DNS for a valid page')

  test('UpdateDapp: Ought to be able to update the dapp we created', async () => {
    const newGuardianURL = casual.url;
    const updateRes = await API.private.updateDapp.call(DappName, {
      GuardianURL: newGuardianURL
    });
    expect(updateRes).toBeSuccessResponse();
    expect(updateRes.data).toBeMessageResult();
    await sleep(1000);
    const updatedRead = await API.private.readDapp.call(DappName);
    expect(updatedRead).toBeSuccessResponse();
    if (!Responses.isSuccessResponse(updatedRead)) return;
    expect(updatedRead.data.exists).toEqual(true);
    expect(updatedRead.data.item).toBeItemApi();
    if (!Dapp.Item.isApi(updatedRead.data.item)) return;
    expect(updatedRead.data.item.GuardianURL).toEqual(newGuardianURL);
  })

  test('Max Capacity: Able to create dapps up until the limit, then get an error', async () => {
    const totalCapacity = parseInt(API.authData.User.UserAttributes["custom:standard_limit"]);
    const listResponse = await API.private.listDapps.call()
    if (!Responses.isSuccessResponse(listResponse)) return;

    // Make as many dapps as required to hit capacity
    const remainingCapacity = totalCapacity - listResponse.data.count;
    for (var x in Array.from({ length: remainingCapacity })) {
      const createRes = await API.private.createDapp.call(DummyDappName(), DummyCreateDappArg())
      expect(createRes).toBeSuccessResponse();
    }

    // This should fail, as we've hit max dapp capacity
    try {
      await API.private.createDapp.call(DummyDappName(), DummyCreateDappArg());
    } catch (err) {
      expect(err.statusCode).toEqual(500);
    }
  })

  test('DeleteDapp: Successfully delete all dapps owned by the account', async () => {
    const listResponse = await API.private.listDapps.call();
    if (!Responses.isSuccessResponse(listResponse)) return;
    const DappNames = listResponse.data.items.map(item => item.DappName);
    for (var DeletingDappName of DappNames) {
      const deleteRes = await API.private.deleteDapp.call(DeletingDappName);
      expect(deleteRes).toBeSuccessResponse();
      expect(deleteRes.data).toBeMessageResult();
    }
    await sleep(500);
    const postListRes = await API.private.listDapps.call();
    if (!Responses.isSuccessResponse(postListRes)) return;
    expect(postListRes.data.count).toEqual(0);
  })
})