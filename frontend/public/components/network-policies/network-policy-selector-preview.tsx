import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';
import { Firehose, ResourceIcon } from '@console/internal/components/utils';

import { FirehoseResult, K8sResourceCommon, PodKind } from '../../module/k8s';
import { NamespaceModel, PodModel } from '../../models';
import { selectorToK8s } from './network-policy-model';

type PodsPreviewResultProps = {
  result?: FirehoseResult<PodKind[]>;
};

const PodsPreviewResult: React.FC<PodsPreviewResultProps> = ({ result }) => {
  // TODO: handle errors in result
  const pods = result?.data || [];

  return (
    <>
      {pods.map((pod) => (
        <DataListItem key={`${pod.metadata.name}.${pod.metadata.namespace}`}>
          <DataListItemRow>
            <DataListItemCells
              dataListCells={[
                <DataListCell key="ns">
                  <ResourceIcon kind={NamespaceModel.kind} />
                  {pod.metadata.namespace}
                </DataListCell>,
                <DataListCell key="pod">
                  <ResourceIcon kind={PodModel.kind} />
                  {pod.metadata.name}
                </DataListCell>,
              ]}
            />
          </DataListItemRow>
        </DataListItem>
      ))}
    </>
  );
};

type PodsPreviewProps = {
  namespace?: string;
  selector: string[][];
};

const PodsPreview: React.FunctionComponent<PodsPreviewProps> = (props) => {
  const { namespace, selector } = props;

  const resources = [
    {
      kind: PodModel.kind,
      isList: true,
      namespace,
      prop: 'result',
      selector: selectorToK8s(selector, null),
    },
  ];

  return (
    <Firehose resources={resources}>
      <PodsPreviewResult />
    </Firehose>
  );
};

type NamespacesPreviewResultProps = {
  result?: FirehoseResult<K8sResourceCommon[]>;
  podSelector: string[][];
};

const NamespacesPreviewResult: React.FC<NamespacesPreviewResultProps> = ({
  result,
  podSelector,
}) => {
  const namespaces = result?.data || [];
  return (
    <>
      {namespaces.map((ns) => (
        <PodsPreview key={ns.metadata.name} namespace={ns.metadata.name} selector={podSelector} />
      ))}
    </>
  );
};

type NamespacesPreviewProps = {
  namespaceSelector: string[][];
  podSelector: string[][];
};

export const NamespacesPreview: React.FunctionComponent<NamespacesPreviewProps> = ({
  namespaceSelector,
  podSelector,
}) => {
  const resources = [
    {
      kind: NamespaceModel.kind,
      isList: true,
      prop: 'result',
      selector: selectorToK8s(namespaceSelector, {}),
    },
  ];

  return (
    <Firehose resources={resources}>
      <NamespacesPreviewResult podSelector={podSelector} />
    </Firehose>
  );
};

export const NetworkPolicySelectorPreview: React.FC<NetworkPolicySelectorPreviewProps> = (
  props,
) => {
  const { t } = useTranslation();
  const [visible, setVisible] = React.useState(false);
  const allNamespaces =
    props.namespaceSelector && props.namespaceSelector.filter((pair) => !!pair[0]).length === 0;

  return (
    <>
      <Button onClick={() => setVisible(!visible)}>
        {visible ? <EyeSlashIcon /> : <EyeIcon />} {t('public~Pods preview')}
      </Button>
      {visible && (
        <DataList aria-label="pods-list">
          {props.namespaceSelector ? (
            allNamespaces ? (
              <PodsPreview selector={props.podSelector} />
            ) : (
              <NamespacesPreview
                namespaceSelector={props.namespaceSelector}
                podSelector={props.podSelector}
              />
            )
          ) : (
            <PodsPreview namespace={props.policyNamespace} selector={props.podSelector} />
          )}
        </DataList>
      )}
    </>
  );
};

type NetworkPolicySelectorPreviewProps = {
  podSelector: string[][];
  namespaceSelector?: string[][];
  policyNamespace: string;
};
