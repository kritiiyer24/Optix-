/** Author: BinaryBeast1209 */
import { registerRootComponent } from 'expo';

import App from './App';
import { installDebug } from './src/debug/log';

installDebug();

registerRootComponent(App);
