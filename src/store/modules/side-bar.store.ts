import Store from 'electron-store';
import {Logger} from '@/components/logger';
import {FileDialog} from '@/renderer/file-dialog';
import {ComponentSaver} from '@/components/component-saver';
import {ComponentTypes} from '@/components/component-types';
import {ComponentFinder} from '@/components/component-finder';
import {ComponentParent} from '@/components/component-parent';
import {ComponentLoader} from '@/components/component-loader';
import {ComponentCloner} from '@/components/component-cloner';
import {CarabinaComponent} from '@/models/carabina-component';
import {CarabinaPublisher} from '@/models/carabina-publisher';
import {ComponentDeleter} from '@/components/component-deleter';
import {ComponentFactory} from '@/components/component-factory';
import {ComponentDecycler} from '@/components/component-decycler';
import {CarabinaRequisition} from '@/models/carabina-requisition';
import {CarabinaSubscription} from '@/models/carabina-subscription';
import requisitionsExample from '@/components/requisitions-example.json';
import {ComponentDragger} from "@/components/component-dragger";

const sidebarRepository = new Store({name: 'side-bar'});

function persist(stage: any) {
    sidebarRepository.set('selectedComponentId', stage.selectedComponent ? stage.selectedComponent.id : null);
    sidebarRepository.set('requisitions', stage.requisitions.map((requisition: any) => new ComponentDecycler().decycle(requisition)));
}

const initialRequisitions = sidebarRepository.get('requisitions', requisitionsExample)
    .map((requisition: any) => ComponentLoader.loadRequisition(requisition));

let initialSelectedComponent: CarabinaComponent | undefined;
let initialSelectedComponentId = sidebarRepository.get('selectedComponentId', null);
if (initialSelectedComponentId) {
    initialSelectedComponent = new ComponentFinder(initialRequisitions).findItem(initialSelectedComponentId);
    if (initialSelectedComponent) {
        initialSelectedComponent.carabinaMeta.selected = true;
    }
} else if (initialRequisitions[0]) {
    initialSelectedComponent = initialRequisitions[0];
    initialSelectedComponentId = initialSelectedComponent!.id;
    initialSelectedComponent!.carabinaMeta.selected = true;
}

function unselectSelectedComponent(stage: any) {
    if (stage.selectedComponent) {
        const foundItem = new ComponentFinder(stage.requisitions).findItem(stage.selectedComponent.id);
        if (foundItem) {
            foundItem.carabinaMeta.selected = false;
        }
    }
}

//TODO test it
export default () => ({
    state: {
        textFilter: '',
        requisitions: initialRequisitions,
        selectedComponent: initialSelectedComponent,
    },
    mutations: {
        componentSelected: (stage: any, component: any) => {
            unselectSelectedComponent(stage);
            const selected = new ComponentFinder(stage.requisitions).findItem(component.id);
            if (selected) {
                stage.selectedComponent = component;
                stage.selectedComponent.carabinaMeta.selected = true;
            }
            persist(stage);
        },
        filterTextChanged: (stage: any, value: string) => stage.textFilter = value,
        addRequisition: (stage: any, requisition: CarabinaRequisition) => {
            if (!new ComponentFinder(stage.requisitions).findItem(requisition.id)) {
                stage.requisitions.push(requisition);
                unselectSelectedComponent(stage);
                stage.selectedComponent = requisition;
                requisition.carabinaMeta.selected = true;
                Logger.info(`Component '${requisition.name}' loaded`);
            } else {
                Logger.info(`Component ${requisition.name} is already opened`);
            }
            persist(stage);
        },
        //TODO Move to another class
        createNewComponent: (stage: any, payload: any) => {
            let createdComponent;
            if (payload.componentType === ComponentTypes.REQUISITION) {
                createdComponent = new ComponentFactory().createRequisition(payload.parent);
                if (!payload.parent) {
                    stage.requisitions.push(createdComponent);
                }
            } else {
                const parentRequisition = payload.parent || new ComponentFactory().createRequisition();
                createdComponent = new ComponentFactory().createComponent(payload.componentType, parentRequisition);
                if (!payload.parent) {
                    stage.requisitions.push(parentRequisition);
                }
                parentRequisition.carabinaMeta.collapsed = false;
            }
            if (payload.startSelected) {
                createdComponent.carabinaMeta.selected = true;
                if (stage.selectedComponent) {
                    stage.selectedComponent.carabinaMeta.selected = false;
                }
                stage.selectedComponent = createdComponent;
            }
            persist(stage);
        },
        currentSelectedComponentChanged: (stage: any, event: any) => {
            if (stage.selectedComponent) {
                stage.selectedComponent[event.attributeName] = event.value;
                persist(stage);
            }
        },
        changeAttributeOfComponent: (stage: any, event: any) => {
            event.component[event.attributeName] = event.value;
            persist(stage);
        },
        duplicateComponent: (stage: any, event: any) => {
            const parent = event.component.carabinaMeta.parent;
            const type = event.component.carabinaMeta.type;
            const component = new ComponentDecycler().decycle(event.component);
            let clone;
            switch (type) {
                case ComponentTypes.REQUISITION:
                    clone = ComponentCloner.cloneRequisition(component as CarabinaRequisition, parent);
                    if (!parent) {
                        stage.requisitions.push(clone);
                    }
                    break;
                case ComponentTypes.PUBLISHER:
                    clone = ComponentCloner.clonePublisher(component as CarabinaPublisher, parent);
                    break;
                // case ComponentTypes.SUBSCRIPTION:
                default:
                    clone = ComponentCloner.cloneSubscription(component as CarabinaSubscription, parent);
                    break;
            }
            clone.carabinaMeta.selected = false;
            persist(stage);
        },
        componentDragAndDrop: (stage: any, event: any) => {
            let target = new ComponentFinder(stage.requisitions).findItem(event.drag.to.id);
            const draggedComponent = event.component;
            const draggedComponentParent = draggedComponent.carabinaMeta.parent || stage;
            const componentDragger = new ComponentDragger(draggedComponent, draggedComponentParent);
            if (!target) {
                if (componentDragger.moveToRoot()) {
                    stage.requisitions.push(draggedComponent);
                }
            } else {
                if (target.carabinaMeta.type !== ComponentTypes.REQUISITION) {
                    target = target.carabinaMeta.parent;
                }
                componentDragger.moveToComponent(target as CarabinaRequisition);
            }
            persist(stage);
        },
        saveComponent: (stage: any, {component}: any) => {
            FileDialog
                .showSaveDialog(component.name + '.nqr.yml')
                .then(filename => {
                    if (filename) {
                        new ComponentSaver()
                            .save(component, filename)
                            .then(() => Logger.info(`Component '${component.name}' saved as '${filename}'`));
                    }
                })
        },
        deleteComponentById: (stage: any, event: any) => {
            stage.requisitions = stage.requisitions.filter((requisition: any) => requisition.id !== event.component.id);
            if (stage.selectedComponent) {
                if (stage.selectedComponent.id === event.component.id || new ComponentParent(stage.selectedComponent).isGrandChildOf(event.component)) {
                    stage.selectedComponent = null;
                }
            }
            new ComponentDeleter(event.component).delete();
            persist(stage);
        },
    },
    getters: {
        selectedComponent: (state: any) => state.selectedComponent,
        textFilter: (state: any) => state.textFilter,
        filteredRequisitions: (state: any) => state.requisitions
            .filter((requisition: CarabinaRequisition) => JSON.stringify(Object.values(new ComponentDecycler().decycle(requisition))).toLowerCase()
                .includes(state.textFilter.toLowerCase())),
        breadcrumbItems: (state: any): any[] => {
            const result = [];
            let parent = state.selectedComponent;
            while (parent.carabinaMeta && parent.carabinaMeta.parent) {
                parent = parent.carabinaMeta.parent;
                result.push({text: parent.name, href: '#', id: parent.id});
            }
            return result.reverse();
        }
    },
    namespaced: true
});
