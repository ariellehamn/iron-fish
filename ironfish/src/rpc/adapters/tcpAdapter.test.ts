/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* eslint-disable jest/no-try-expect */
/* eslint-disable jest/no-conditional-expect */
import os from 'os'
import * as yup from 'yup'
import { Assert } from '../../assert'
import { IronfishSdk } from '../../sdk'
import { RpcRequestError } from '../clients'
import { RpcTcpClient } from '../clients/tcpClient'
import { ALL_API_NAMESPACES } from '../routes'
import { ERROR_CODES, ValidationError } from './errors'
import { RpcTcpAdapter } from './tcpAdapter'

describe('TcpAdapter', () => {
  let tcp: RpcTcpAdapter | undefined
  let sdk: IronfishSdk
  let client: RpcTcpClient | undefined

  beforeEach(async () => {
    const dataDir = os.tmpdir()

    sdk = await IronfishSdk.init({
      dataDir,
      configOverrides: {
        enableRpc: false,
        enableRpcIpc: false,
        enableRpcTcp: false,
        enableRpcTls: false,
        rpcTcpPort: 0,
      },
    })

    const node = await sdk.node()

    tcp = new RpcTcpAdapter('localhost', 0, undefined, ALL_API_NAMESPACES)

    await node.rpc.mount(tcp)
  })

  afterEach(() => {
    client?.close()
    tcp?.stop()
  })

  it('should send and receive message', async () => {
    await tcp?.start()
    Assert.isNotUndefined(tcp)
    Assert.isNotNull(tcp?.router)
    Assert.isNotNull(tcp?.addressPort)

    tcp.router.register('foo/bar', yup.string(), (request) => {
      request.end(request.data)
    })

    client = new RpcTcpClient('localhost', tcp.addressPort, 'test token')
    await client.connect()

    const response = await client.request('foo/bar', 'hello world').waitForEnd()
    expect(response.content).toBe('hello world')
  })

  it('should stream message', async () => {
    await tcp?.start()
    Assert.isNotUndefined(tcp)
    Assert.isNotNull(tcp?.router)
    Assert.isNotNull(tcp?.addressPort)

    tcp.router.register('foo/bar', yup.object({}), (request) => {
      request.stream('hello 1')
      request.stream('hello 2')
      request.end()
    })

    client = new RpcTcpClient('localhost', tcp.addressPort, 'test token')
    await client.connect()

    const response = client.request('foo/bar', 'test token')
    expect((await response.contentStream().next()).value).toBe('hello 1')
    expect((await response.contentStream().next()).value).toBe('hello 2')

    await response.waitForEnd()
    expect(response.content).toBe(undefined)
  })

  it('should handle errors', async () => {
    await tcp?.start()
    Assert.isNotUndefined(tcp)
    Assert.isNotNull(tcp?.router)
    Assert.isNotNull(tcp?.addressPort)

    tcp.router.register('foo/bar', yup.object({}), () => {
      throw new ValidationError('hello error', 402, 'hello-error' as ERROR_CODES)
    })

    client = new RpcTcpClient('localhost', tcp.addressPort, 'test token')
    await client.connect()

    const response = client.request('foo/bar', 'test token')

    await expect(response.waitForEnd()).rejects.toThrowError(RpcRequestError)
    await expect(response.waitForEnd()).rejects.toMatchObject({
      status: 402,
      code: 'hello-error',
      codeMessage: 'hello error',
    })
  })

  it('should handle request errors', async () => {
    await tcp?.start()
    Assert.isNotUndefined(tcp)
    Assert.isNotNull(tcp?.router)
    Assert.isNotNull(tcp?.addressPort)

    // Requires this
    const schema = yup.string().defined()
    // But send this instead
    const body = undefined

    tcp.router.register('foo/bar', schema, (res) => res.end())

    client = new RpcTcpClient('localhost', tcp.addressPort, 'test token')
    await client.connect()

    const response = client.request('foo/bar', 'test token', body)

    await expect(response.waitForEnd()).rejects.toThrowError(RpcRequestError)
    await expect(response.waitForEnd()).rejects.toMatchObject({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      codeMessage: expect.stringContaining('this must be defined'),
    })
  })

  it('should authenticate', async () => {
    tcp = new RpcTcpAdapter('localhost', 0, undefined, ALL_API_NAMESPACES, true)
    await tcp?.start()
    Assert.isNotUndefined(tcp)
    Assert.isNotNull(tcp?.router)
    Assert.isNotNull(tcp?.addressPort)

    // Requires this
    const schema = yup.string().defined()
    // But send this instead
    const body = undefined

    tcp.router.register('foo/bar', schema, (res) => res.end())

    client = new RpcTcpClient('localhost', tcp.addressPort, 'test token')
    await client.connect()

    const response = client.request('foo/bar', body)

    await expect(response.waitForEnd()).rejects.toThrowError(RpcRequestError)
    await expect(response.waitForEnd()).rejects.toMatchObject({
      status: 400,
      code: ERROR_CODES.ERROR,
      codeMessage: expect.stringContaining('Missing or bad authentication'),
    })
  })
})
