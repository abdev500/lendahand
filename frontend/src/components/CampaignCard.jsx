import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './CampaignCard.css'

function CampaignCard({ campaign }) {
  const { t } = useTranslation()

  return (
    <div className="campaign-card">
      {campaign.media && campaign.media.length > 0 && (
        <div className="campaign-image">
          <img
            src={campaign.media[0].file}
            alt={campaign.title}
          />
        </div>
      )}
      <div className="campaign-content">
        <h3>{campaign.title}</h3>
        <p className="campaign-short">{campaign.short_description}</p>
        <div className="campaign-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${campaign.progress_percentage}%` }}
            />
          </div>
          <div className="progress-stats">
            <span>${campaign.current_amount.toLocaleString()}</span>
            <span>of ${campaign.target_amount.toLocaleString()}</span>
          </div>
        </div>
        <Link to={`/campaign/${campaign.id}`} className="campaign-link">
          {t('campaign.donate')}
        </Link>
      </div>
    </div>
  )
}

export default CampaignCard

