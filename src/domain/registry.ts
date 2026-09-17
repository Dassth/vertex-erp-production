/* Importing every domain module registers all commands (see common.ts `command`). */
import './dispatch'
import './imports'
import './master'
import './orderCosting'
import './planning'
import './production'
import './resources'
import './system'

export { COMMANDS } from './common'
