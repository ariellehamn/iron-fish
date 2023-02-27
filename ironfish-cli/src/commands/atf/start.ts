/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { FileUtils } from '@ironfish/sdk'
import { Flags } from '@oclif/core'
import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process'
import util from 'util'
import { IronfishCommand } from '../../command'

/**
 * TODOs
 * - create miner nodes
 * - send transactions around
 * - support mempool sizing in config
 * - main proc should wait on all node shutdown
 * - don't print out all the logs, just the important stuff
 *   - add command to tail logs for a specific node
 */

type TestNodeConfig = {
  name: string
  graffiti: string
  port: string
  data_dir: string
  netword_id: number
}
class TestNode {
  // holds node process
  proc: ChildProcessWithoutNullStreams

  rootCmd = 'ironfish'

  name: string
  graffiti: string
  port: string
  data_dir: string
  netword_id: number

  constructor(config: TestNodeConfig) {
    this.name = config.name
    this.graffiti = config.graffiti
    this.port = config.port
    this.data_dir = config.data_dir
    this.netword_id = config.netword_id

    // this is gross fix this
    const args =
      'start --name ' +
      config.name +
      ' --graffiti ' +
      config.graffiti +
      ' --port ' +
      config.port +
      ' --datadir ' +
      config.data_dir +
      ' --networkId ' +
      config.netword_id.toString()

    this.proc = this.start(args)
  }

  // TODO: if fails to start, return err?
  start(args: string): ChildProcessWithoutNullStreams {
    // TODO: typescript this
    const proc = spawn(this.rootCmd, args.split(' '))
    proc.stdout.on('data', (data: any) => {
      console.log(`[${this.name}]: ${data}`)
    })

    proc.stderr.on('data', (data: any) => {
      console.log(`[${this.name}:stderr]: ${data}`)
    })

    proc.on('error', (error: any) => {
      console.log(`[${this.name}:error]: ${error.message}`)
    })

    proc.on('close', (code: any) => {
      console.log(`[${this.name}:close]: child process exited with code ${code}`)
    })

    return proc
  }

  // help i'm alive
  alive(): boolean {
    return this.proc.exitCode === null
  }

  async stop(): Promise<{ success: boolean; msg: string }> {
    console.log(`killing node ${this.name}...`)

    const execPromise = util.promisify(exec)

    const { stdout, stderr } = await execPromise(
      `${this.rootCmd} stop --datadir ${this.data_dir}`,
    )

    return new Promise((resolve, reject) => {
      if (stderr) {
        reject({ success: false, msg: stderr })
      } else {
        resolve({ success: true, msg: stdout })
      }
    })
  }
}

export default class Spawn extends IronfishCommand {
  static description = 'Spawn a test network'

  async start(): Promise<void> {
    await this.sdk.connectRpc()

    const config = [
      {
        name: 'node1',
        graffiti: '1',
        port: '8001',
        data_dir: '~/.ironfish_atf/node1',
        netword_id: 2,
      },
      {
        name: 'node2',
        graffiti: '2',
        port: '8002',
        data_dir: '~/.ironfish_atf/node2',
        netword_id: 2,
      },
      {
        name: 'node3',
        graffiti: '3',
        port: '8003',
        data_dir: '~/.ironfish_atf/node3',
        netword_id: 2,
      },
    ]

    console.log('f')

    const nodes = config.map((cfg) => {
      return new TestNode(cfg)
    })

    await sleep(10 * second)

    for (const node of nodes) {
      const { success, msg } = await node.stop()
      if (!success) {
        console.log(`[main]: error stopping node ${node.name}: ${msg}`)
      } else {
        console.log(`[main]: stopped node ${node.name} successfully`)
      }
    }
    // press x to exit
  }
}

const second = 1000

function sleep(ms: number): Promise<void> {
  console.log(`sleeping...  ${ms / 1000}s`)
  return new Promise((resolve) => setTimeout(resolve, ms))
}
