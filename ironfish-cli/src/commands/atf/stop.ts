/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { exec } from 'child_process'
import util from 'util'
import { IronfishCommand } from '../../command'
import { config, sleep } from './start'

export default class Stop extends IronfishCommand {
  async start(): Promise<void> {
    const nodes = config

    await Promise.all(
      nodes.map(async (node) => {
        const { success, msg } = await remoteStop(node)
        if (!success) {
          console.log(`couldn't stop node ${node.name}: ${msg}`)
        }
      }),
    )
  }
}

async function remoteStop(node: {
  name: string
  data_dir: string
}): Promise<{ success: boolean; msg: string }> {
  console.log(`killing node ${node.name}...`)

  const execPromise = util.promisify(exec)

  const { stdout, stderr } = await execPromise(`$ironfish stop --datadir ${node.data_dir}`)

  return new Promise((resolve, reject) => {
    if (stderr) {
      reject({ success: false, msg: stderr })
    } else {
      resolve({ success: true, msg: stdout })
    }
  })
}
