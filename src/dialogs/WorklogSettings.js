import React from 'react';
import BaseDialog from './BaseDialog';
import { Button, TextBox } from '../controls';
import { TabView, TabPanel } from 'primereact/tabview';

class WorklogSettings extends BaseDialog {
    constructor(props) {
        super(props, "Report configurations");
        this.className = "no-padding";

        var { pageSettings } = props;
        this.state = { showDialog: true, pageSettings: { ...pageSettings } };
    }

    getFooter() {
        return <Button icon="fa fa-floppy-o" label="Done" onClick={this.onDone} />
    }

    onDone = () => {
        this.onHide(this.state.pageSettings);
    }

    setValue = (field, value) => {
        var { pageSettings } = this.state;
        pageSettings[field] = value;
        pageSettings = { ...pageSettings };
        this.setState({ pageSettings });
    }

    render() {
        var { setValue, state: { pageSettings: { groupMode, logFormat, breakupMode, timeZone, jql } } } = this;

        return super.renderBase(
            <TabView styleclass="query-tab">
                <TabPanel header="General" lefticon="fa-cog" selected="true">
                    <div className="form-group row">
                        <label className="col-md-3 col-form-label">Grouping</label>
                        <div className="col-md-9 col-form-label">
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={groupMode} onChange={() => setValue("groupMode", "1")} type="radio" checked={groupMode === "1"} name="grouping" />
                                    Display report grouped based on User and date
                                </label>
                            </div>
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={groupMode} onChange={() => setValue("groupMode", "2")} type="radio" checked={groupMode === "2"} name="grouping" />
                                    Display report in flat structure without any grouping
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="form-group row">
                        <label className="col-md-3 col-form-label">Log hour format</label>
                        <div className="col-md-9 col-form-label">
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={logFormat} onChange={() => setValue("logFormat", "1")} type="radio" checked={logFormat === "1"} name="hourformat" />
                                    Format hours (2h 30m)
                                </label>
                            </div>
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={logFormat} onChange={() => setValue("logFormat", "2")} type="radio" checked={logFormat === "2"} name="hourformat" />
                                    Show in hours (2.5)
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="form-group row">
                        <label className="col-md-3 col-form-label">Log breakup</label>
                        <div className="col-md-9 col-form-label">
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={breakupMode} onChange={() => setValue("breakupMode", "1")} type="radio" checked={breakupMode === "1"} name="logbreakup" />
                                    Single entry (Sum worklog added for same ticket on same day)
                                </label>
                            </div>
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={breakupMode} onChange={() => setValue("breakupMode", "2")} type="radio" checked={breakupMode === "2"} name="logbreakup" />
                                    Individual entry (Display individual entry for each of the worklog)
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="form-group row">
                        <label className="col-md-3 col-form-label">Report timezone (experimental)</label>
                        <div className="col-md-9 col-form-label">
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={timeZone} onChange={() => setValue("timeZone", "1")} type="radio" checked={timeZone === "1"} name="timezone" />
                                    Use my local time zone for all users
                                </label>
                            </div>
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={timeZone} onChange={() => setValue("timeZone", "2")} type="radio" checked={timeZone === "2"} name="timezone" />
                                    Use containing groups timezone for all users
                                </label>
                            </div>
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input className="form-check-input" value={timeZone} onChange={() => setValue("timeZone", "3")} type="radio" checked={timeZone === "3"} name="timezone" />
                                    Use individual users timezone
                                </label>
                            </div>
                        </div>
                    </div>
                </TabPanel>
                <TabPanel header="JQL Filter" lefticon="fa-filter">
                    <TextBox multiline={true} value={jql} onChange={(val) => setValue("jql", val)} style={{ width: '100%', height: 323 }}
                        placeholder="Provide the additional JQL filters to be applied while fetching data." defaultValue={""} />
                    <span><strong>Note:</strong> Date range and user list filter will be added automatically.</span>
                </TabPanel>
            </TabView>
        );
    }
}

export default WorklogSettings;