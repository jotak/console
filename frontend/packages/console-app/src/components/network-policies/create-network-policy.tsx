import * as React from 'react';
import { Divider, Tooltip } from '@patternfly/react-core';
import { safeLoad, safeDump } from 'js-yaml';
import * as _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { getActiveNamespace } from '@console/internal/actions/ui';
import { confirmModal } from '@console/internal/components/modals/confirm-modal';
import { RadioInput } from '@console/internal/components/radio';
import { ResourceSidebar } from '@console/internal/components/sidebars/resource-sidebar';
import { resourceObjPath } from '@console/internal/components/utils';
import { AsyncComponent } from '@console/internal/components/utils/async';
import { getYAMLTemplates } from '@console/internal/models/yaml-templates';
import { referenceFor } from '@console/internal/module/k8s';
import {
  getResourceSidebarSamples,
  RedExclamationCircleIcon,
  YellowExclamationTriangleIcon,
} from '@console/shared';
import { downloadYaml } from '@console/shared/src/components/editor/yaml-download-utils';
import { NetworkPolicyForm } from './network-policy-form';
import {
  isNetworkPolicyConversionError,
  NetworkPolicy,
  networkPolicyFromK8sResource,
  networkPolicyNormalizeK8sResource,
  networkPolicyToK8sResource,
} from './network-policy-model';

type ViewMode = 'form' | 'yaml';

type Props = { models: any };

const stateToProps = ({ k8s }) => ({
  models: k8s.getIn(['RESOURCES', 'models']),
});

const CreateNetworkPolicyWithModels: React.FunctionComponent<Props> = (props) => {
  const { t } = useTranslation();
  const emptyPolicy: NetworkPolicy = {
    name: '',
    namespace: getActiveNamespace(),
    podSelector: [['', '']],
    ingress: {
      denyAll: false,
      rules: [],
    },
    egress: {
      denyAll: false,
      rules: [],
    },
  };
  const [networkPolicy, setNetworkPolicy] = React.useState(emptyPolicy);
  const [viewMode, setViewMode] = React.useState('form' as ViewMode);
  const [unsupportedYAML, setUnsupportedYAML] = React.useState(false);
  const [yamlError, setYAMLError] = React.useState(null as string | null);

  const k8sObj = networkPolicyToK8sResource(networkPolicy, t);
  const model = props.models.get(referenceFor(k8sObj)) || props.models.get(k8sObj.kind);
  const { samples, snippets } = model
    ? getResourceSidebarSamples(model, undefined, t)
    : { samples: [], snippets: [] };

  const confirmLossUnsupported = (execute: () => void) => {
    confirmModal({
      title: (
        <>
          <YellowExclamationTriangleIcon className="co-icon-space-r" />
          {t('public~Unsupported YAML')}
        </>
      ),
      message: t(
        'public~Some elements found in YAML are not supported in the form view, and will be lost when switching views. Do you want to continue?',
      ),
      btnText: t('public~Continue'),
      executeFn: () => {
        execute();
        return Promise.resolve();
      },
    });
  };

  const confirmFullLoss = (err: string, execute: () => void) => {
    confirmModal({
      title: (
        <>
          <RedExclamationCircleIcon className="co-icon-space-r" />
          {t('public~Invalid YAML')}
        </>
      ),
      message: `${err} ${t('public~Invalid changes will be ignored. Do you want to continue?')}`,
      btnText: t('public~Continue'),
      executeFn: () => {
        execute();
        return Promise.resolve();
      },
    });
  };

  const yamlObjToForm = (yaml) => {
    setUnsupportedYAML(false);
    setYAMLError(null);
    const normalizedK8S = networkPolicyNormalizeK8sResource(yaml);
    const converted = networkPolicyFromK8sResource(normalizedK8S, t);
    if (isNetworkPolicyConversionError(converted)) {
      setYAMLError(converted.error);
    } else {
      // Convert back to check for unsupported fields (check isomorphism)
      const reconverted = networkPolicyToK8sResource(converted, t);
      if (isNetworkPolicyConversionError(reconverted)) {
        setYAMLError(reconverted.error);
      } else {
        if (!_.isEqual(normalizedK8S, reconverted)) {
          setUnsupportedYAML(true);
        }
        setNetworkPolicy(converted);
      }
    }
  };

  const yamlTextToForm = (text: string) => {
    setYAMLError(null);
    try {
      yamlObjToForm(safeLoad(text));
    } catch (e) {
      setYAMLError(e.toString());
    }
  };

  const yamlSnippetToForm = (id, yamlContent, kind) => {
    const sampleObj = safeLoad(getYAMLTemplates().getIn([kind, id]));
    sampleObj.metadata.namespace = networkPolicy.namespace;
    yamlObjToForm(sampleObj);
  };

  const downloadYamlContent = (id, yamlContent, kind) => {
    const sampleObj = safeLoad(getYAMLTemplates().getIn([kind, id]));
    sampleObj.metadata.namespace = networkPolicy.namespace;
    try {
      const yaml = safeDump(sampleObj);
      downloadYaml(yaml);
    } catch (e) {
      downloadYaml(t('public~Error getting YAML: {{e}}', { e }));
    }
  };

  const switchToForm = () => {
    setYAMLError(null);
    setUnsupportedYAML(false);
    setViewMode('form');
  };

  const FormViewRadio = () => (
    <RadioInput
      title={t('public~Form view')}
      inline
      onChange={() => {
        if (yamlError) {
          confirmFullLoss(yamlError, switchToForm);
        } else if (unsupportedYAML) {
          confirmLossUnsupported(switchToForm);
        } else {
          switchToForm();
        }
      }}
      checked={viewMode === 'form'}
      name="form-view"
      value="form-view"
    />
  );

  return (
    <>
      <div className="yaml-editor__header">
        <h1 className="yaml-editor__header-text">{t('public~Create NetworkPolicy')}</h1>
        <p className="help-block">{t('public~Create using the form or using the YAML editor.')}</p>
        <Divider style={{ paddingTop: 10, paddingBottom: 10 }} />
        <div className="form-group">
          <label style={{ marginRight: 10 }}>{t('public~Configure via:')}</label>
          {yamlError ? (
            <Tooltip content={t('public~Invalid YAML: {{yamlError}}', { yamlError })}>
              <span>
                <FormViewRadio />
                <RedExclamationCircleIcon className="co-icon-space-l co-icon-space-r" />
              </span>
            </Tooltip>
          ) : unsupportedYAML ? (
            <Tooltip content={t('public~Unsupported YAML')}>
              <span>
                <FormViewRadio />
                <YellowExclamationTriangleIcon className="co-icon-space-l co-icon-space-r" />
              </span>
            </Tooltip>
          ) : (
            <FormViewRadio />
          )}
          <RadioInput
            title={t('public~YAML view')}
            inline
            onChange={() => setViewMode('yaml')}
            checked={viewMode === 'yaml'}
            name="yaml-view"
            value="yaml-view"
          />
        </div>
      </div>
      {viewMode === 'yaml' ? (
        <AsyncComponent
          loader={() =>
            import('@console/internal/components/droppable-edit-yaml').then(
              (c) => c.DroppableEditYAML,
            )
          }
          obj={k8sObj}
          create
          kind={k8sObj.kind}
          hideHeader
          resourceObjPath={resourceObjPath}
          onChange={yamlTextToForm}
        />
      ) : (
        <div className="co-m-page__body">
          <div className="co-p-has-sidebar">
            <div className="co-m-pane__body co-p-has-sidebar__body">
              <NetworkPolicyForm
                networkPolicy={networkPolicy}
                setNetworkPolicy={setNetworkPolicy}
              />
            </div>
            <ResourceSidebar
              kindObj={model}
              samples={samples}
              snippets={snippets}
              schema={undefined}
              sidebarLabel={undefined}
              loadSampleYaml={yamlSnippetToForm}
              insertSnippetYaml={() => {}}
              downloadSampleYaml={downloadYamlContent}
              toggleSidebar={() => {}}
            />
          </div>
        </div>
      )}
    </>
  );
};

export const CreateNetworkPolicy = connect(stateToProps)(CreateNetworkPolicyWithModels);
