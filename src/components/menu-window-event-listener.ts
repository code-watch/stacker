import store from '@/store'
import LZString from 'lz-string';
import {FileDialog} from '@/components/file-dialog';
import {ComponentTypes} from '@/components/component-types';
import {ComponentLoader} from '@/components/component-loader';
import {EnvironmentLoader} from '@/environments/environment-loader';
import {RendererMessageCommunicator} from '@/components/renderer-message-communicator';
import {Logger} from "@/components/logger";

// stage
RendererMessageCommunicator.on('addLog', ((event, data) => store.commit('stage/addLog', data)));

RendererMessageCommunicator.on('loadPlugin', ((event, data) => store.dispatch('stage/loadPlugins', data)));

RendererMessageCommunicator.on('enqueuerLog', ((event, data) => {
    const decompress = LZString.decompressFromUTF16(data);
    store.commit('stage/addEnqueuerLog', decompress);
}));

RendererMessageCommunicator.on('runCurrentlySelectedComponent', (() => store.commit('stage/runCurrentlySelectedComponent')));

RendererMessageCommunicator.on('runHighestParentOfSelectedComponent', (() => store.commit('stage/runHighestParentOfSelectedComponent')));

// side-bar
RendererMessageCommunicator
    .on('newRequisition', () => store.commit('side-bar/createNewComponent', {
        componentType: ComponentTypes.REQUISITION,
        startSelected: true
    }));

RendererMessageCommunicator
    .on('newPublisher', () => store.commit('side-bar/createNewComponent', {
        componentType: ComponentTypes.PUBLISHER,
        startSelected: true
    }));

RendererMessageCommunicator
    .on('newSubscription', () => store.commit('side-bar/createNewComponent', {
        componentType: ComponentTypes.SUBSCRIPTION,
        startSelected: true
    }));

RendererMessageCommunicator
    .on('openComponent', async () => (await FileDialog.showOpenDialog())
        .map(async file => await ComponentLoader.importFile(file))
        .map(async (requisitionPromise: any) => {
            try {
                if (requisitionPromise) {
                    const requisition = await requisitionPromise;
                    store.commit('side-bar/addRequisition', requisition);
                    Logger.info(`Component '${requisition.name}' loaded`);
                }
            } catch (e) {
                Logger.error(`Error loading '${e}'`);
            }
        }));

RendererMessageCommunicator
    .on('importPostmanCollection', async () => (await FileDialog.showOpenDialog())
        .map(async file => await ComponentLoader.importFromPostman(file))
        .map(async (requisitionPromise: any) => {
            try {
                if (requisitionPromise) {
                    const requisition = await requisitionPromise;
                    store.commit('side-bar/addRequisition', requisition);
                    Logger.info(`Postman collection '${requisition.name}' loaded`);
                }
            } catch (e) {
                Logger.error(`Error loading '${e}'`);
            }
        }));

// nav-bar
RendererMessageCommunicator.on('openEnvironment',
    async () => {
        const environments = await EnvironmentLoader.importEnvironment();
        environments
            .filter(item => item)
            .forEach(environment => {
                store.commit('nav-bar/addEnvironment', environment);
            });
    });

RendererMessageCommunicator.on('importPostmanEnvironment',
    async () => {
        const postmanEnvironments = await EnvironmentLoader.importPostmanEnvironment();
        postmanEnvironments
            .filter(item => item)
            .forEach(postmanEnvironment => {
                store.commit('nav-bar/addEnvironment', postmanEnvironment);
            });
    });
